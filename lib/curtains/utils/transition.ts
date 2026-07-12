import { stagger } from "motion-dom"
import { Transition } from "motion-dom"

const DEFAULT_TRANSITION: Transition = {
    duration: 0.5,
    ease: [0.76, 0, 0.24, 1],
}

/** Total spread, in seconds, a default tile stagger fills. */
const DEFAULT_STAGGER_WINDOW = 0.4

/** Merge the user's transition over curtains' defaults (user wins). */
export function resolveTransition(transition?: Transition): Transition {
    return { ...DEFAULT_TRANSITION, ...transition }
}

/**
 * As `resolveTransition`, but for effects animating many elements: if the
 * user didn't specify a `delay`, fill one in with a `stagger()` scaled to the
 * tile count so the sweep reads at any grid size. An explicit `delay`
 * suppresses the stagger — the mixed-effect handoff in `curtains` relies on
 * this, passing `delay: 0` (its `INSTANT` transition) to snap every tile
 * covered at once rather than staggering the handoff over real time.
 */
export function resolveTileTransition(
    transition: Transition | undefined,
    count: number,
    spread = DEFAULT_STAGGER_WINDOW
): Transition {
    const resolved = resolveTransition(transition)
    if (resolved.delay === undefined && count > 1) {
        // mini `animate` resolves a DynamicOption delay per element; the
        // public Transition type only types `delay` as a number.
        resolved.delay = stagger(spread / count) as unknown as number
    }
    return resolved
}

/**
 * As `resolveTileTransition`, but for effects that compute an explicit per-tile
 * delay (e.g. a directional sweep): `fractions[i]` in `[0, 1]` scales across
 * `spread` to the tile's delay. As above, an explicit `delay` (the `INSTANT`
 * handoff's `delay: 0`) suppresses the stagger so every tile flips at once.
 */
export function tileDelayTransition(
    transition: Transition | undefined,
    fractions: number[],
    spread = DEFAULT_STAGGER_WINDOW
): Transition {
    const resolved = resolveTransition(transition)
    if (resolved.delay === undefined) {
        // a DynamicOption delay, resolved per element by index (see above).
        resolved.delay = ((i: number) =>
            spread * fractions[i]) as unknown as number
    }
    return resolved
}
