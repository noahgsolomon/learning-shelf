import { Transition } from "motion-dom"
import { createContainer, createScopedContainer } from "./container"
import { BoxSize, CurtainEffect, CurtainsCallback } from "./types"

/**
 * Timing that snaps straight to the covered state with no animation — used to
 * hand a mixed reveal effect its starting cover. `delay: 0` also cancels the
 * tile stagger so every element of a grid/strip effect covers at once.
 */
const INSTANT: Transition = { duration: 0, delay: 0 }

/**
 * One queued `curtains()` call. The cover always uses the cycle's *first* job's
 * `inEffect`/`coverTransition`; the reveal uses the *last* surviving job's
 * `outEffect`/`revealTransition` — which is how a coalesced batch reveals with
 * the most recent caller's effect. `resolve`/`reject` are the job's own awaiter;
 * `settled` guards them against a double fire.
 */
export interface CurtainsJob {
    callback: CurtainsCallback
    inEffect: CurtainEffect
    outEffect: CurtainEffect
    coverTransition?: Transition
    revealTransition?: Transition
    resolve: () => void
    reject: (reason: unknown) => void
    settled: boolean
}

/**
 * Per-scope coordination state. `batch` is the cycle currently covering/draining
 * (jobs coalesce into it while the scope is occluded); `pending` collects jobs
 * that arrive once the reveal has started, to run as a fresh cycle afterwards.
 */
interface ScopeState {
    phase: "covering" | "revealing"
    batch: CurtainsJob[]
    pending: CurtainsJob[]
}

/** Map key for the viewport (undefined-scope) slot, distinct from any element. */
const VIEWPORT = Symbol()

/**
 * Live cycles, keyed per scope so independent regions never block each other.
 * Entries are deleted the moment a scope goes idle, so this never retains a
 * scope element past its last transition.
 */
const scopes = new Map<HTMLElement | typeof VIEWPORT, ScopeState>()

function resolveJob(job: CurtainsJob): void {
    if (job.settled) return
    job.settled = true
    job.resolve()
}

function rejectJob(job: CurtainsJob, reason: unknown): void {
    if (job.settled) return
    job.settled = true
    job.reject(reason)
}

/**
 * Queue a job against its scope. A fresh scope starts a cycle immediately; an
 * occluded scope coalesces the job into the in-flight batch; a revealing scope
 * defers it to the next cycle. Synchronous up to the cover starting, so a second
 * call in the same tick reliably sees the first scope's state.
 */
export function schedule(
    scope: HTMLElement | undefined,
    job: CurtainsJob
): void {
    const key = scope ?? VIEWPORT
    const existing = scopes.get(key)

    if (!existing) {
        const state: ScopeState = {
            phase: "covering",
            batch: [job],
            pending: [],
        }
        scopes.set(key, state)
        // Detached: runCycle never rejects (it settles every job internally), so
        // there is no floating rejection to handle here.
        runCycle(scope, state)
        return
    }

    if (existing.phase === "covering") existing.batch.push(job)
    else existing.pending.push(job)
}

/**
 * Run one cover → drain → reveal cycle for a scope, then chain straight into the
 * next cycle if calls queued during the reveal, or go idle. Never rejects: every
 * job is settled (resolved or rejected) before this returns.
 */
async function runCycle(
    scope: HTMLElement | undefined,
    state: ScopeState
): Promise<void> {
    let container: { element: HTMLElement; remove: () => void } | undefined

    try {
        // Cover always belongs to the first job — it owns the cycle. Capture its
        // effect now: `batch[0]` is stable (jobs only ever append).
        const coverEffect = state.batch[0].inEffect
        const coverTransition = state.batch[0].coverTransition

        container = scope ? createScopedContainer(scope) : createContainer()

        // A scoped overlay sizes from its real box and must NOT fall back to the
        // viewport; a viewport overlay passes no box, letting `boxSize` fall back
        // to window dims (e.g. jsdom) when the rect reads 0.
        let box: BoxSize | undefined
        if (scope) {
            const rect = container.element.getBoundingClientRect()
            box = { width: rect.width, height: rect.height }
        }
        const host = container.element

        coverEffect.setup(host, box)
        await coverEffect.cover(coverTransition).finished

        // Drain every job that has accumulated while covered, in turn. Jobs that
        // arrive during the drain append to `state.batch` and this same loop
        // picks them up (we don't guard against an unbounded arrival stream).
        for (let i = 0; i < state.batch.length; i++) {
            const job = state.batch[i]
            try {
                await job.callback()
            } catch (error) {
                // A throwing swap rejects only its own awaiter; the batch keeps
                // draining and the survivors still reveal.
                rejectJob(job, error)
            }
        }

        // Point of no return: from here a reveal will expose content, so flip
        // synchronously (no await since the loop ended) and send later arrivals
        // to the next cycle instead of this batch.
        state.phase = "revealing"

        const survivors = state.batch.filter((job) => !job.settled)
        if (survivors.length) {
            // Reveal with the most recent caller's effect/timing.
            const last = survivors[survivors.length - 1]
            const outEffect = last.outEffect

            if (outEffect !== coverEffect) {
                // Mixed effects: hand the cover over to the reveal effect while
                // the page is fully occluded. Build it, snap it to the covered
                // state (no animation), then drop the cover effect's now-redundant
                // overlay out from beneath it — at no point is anything exposed.
                const covering = Array.from(host.children)
                outEffect.setup(host, box)
                await outEffect.cover(INSTANT).finished
                for (const node of covering) node.remove()
            }

            await outEffect.reveal(last.revealTransition).finished
            for (const job of survivors) resolveJob(job)
        }
        // else: every swap in the batch threw — tear down without revealing (the
        // overlay is yanked), mirroring the single-call throw path.
    } catch (error) {
        // Cover/reveal/setup failed: reject whatever is still in flight.
        for (const job of state.batch) rejectJob(job, error)
    } finally {
        container?.remove()
    }

    // Advance: a fresh cover → reveal for anything queued during the reveal,
    // otherwise the scope is idle and drops out of the map.
    if (state.pending.length) {
        state.batch = state.pending
        state.pending = []
        state.phase = "covering"
        runCycle(scope, state)
    } else {
        scopes.delete(scope ?? VIEWPORT)
    }
}
