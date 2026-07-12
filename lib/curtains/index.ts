import { schedule } from "./coordinator"
import { fade } from "./effects/fade"
import { prefersReducedMotion } from "./reduced-motion"
import {
    CurtainEffect,
    CurtainEffectFactory,
    CurtainsCallback,
    CurtainsOptions,
} from "./types"

function resolveEffect(
    effect: CurtainEffect | CurtainEffectFactory | undefined
): CurtainEffect {
    if (!effect) return fade()
    return typeof effect === "function" ? effect() : effect
}

/**
 * Split a `value | [cover, reveal]` option into its two phases: a scalar
 * applies to both, a `[cover, reveal]` tuple sets each — the same scalar-or-
 * tuple shape as the `direction` option. `T` must be a non-array type (an
 * array value is read as the tuple).
 */
function resolvePair<T>(
    value: T | [T, T] | undefined
): [T | undefined, T | undefined] {
    return Array.isArray(value) ? [value[0], value[1]] : [value, value]
}

/**
 * Resolve the cover/reveal effect pair. A scalar effect (or a tuple whose two
 * entries are the same reference) collapses to a single shared instance, so
 * `inEffect === outEffect` — which is precisely what gates the mixed-effect
 * handoff in the coordinator. Two different effects resolve to two instances.
 */
function resolveEffects(
    effect: CurtainsOptions["effect"]
): [CurtainEffect, CurtainEffect] {
    const [inOption, outOption] = resolvePair(effect)
    const inEffect = resolveEffect(inOption)
    const outEffect =
        outOption === inOption ? inEffect : resolveEffect(outOption)
    return [inEffect, outEffect]
}

/**
 * Run a page transition between two views, stage-curtain style: cover the
 * viewport, run `callback` to swap content while it's hidden, then reveal.
 *
 * ```ts
 * await curtains(
 *     async () => {
 *         await downloadFonts()
 *         updateDOM()
 *     },
 *     { effect: wipe({ direction: "left" }), transition: { duration: 0.2 } }
 * )
 * ```
 *
 * Pass a `[in, out]` tuple to `effect` (and optionally `transition`) to mix a
 * different effect or timing for the reveal:
 *
 * ```ts
 * await curtains(updateDOM, {
 *     effect: [wipe({ direction: "left" }), iris()],
 *     transition: [{ duration: 0.3 }, { duration: 0.5 }],
 * })
 * ```
 *
 * The promise resolves once the reveal completes. Respects
 * `prefers-reduced-motion` by swapping with no transition.
 */
export async function curtains(
    callback: CurtainsCallback,
    options: CurtainsOptions = {}
): Promise<void> {
    // Reduced motion bypasses the coordinator entirely: there is no overlay to
    // coalesce, so just run the swap and return.
    if (prefersReducedMotion()) {
        await callback()
        return
    }

    const [inEffect, outEffect] = resolveEffects(options.effect)
    const [coverTransition, revealTransition] = resolvePair(options.transition)

    // Hand off to the per-scope coordinator, which covers, runs the swap while
    // occluded, then reveals — coalescing concurrent calls to the same scope
    // (rather than stacking overlays) and queueing any that arrive mid-reveal.
    return new Promise<void>((resolve, reject) => {
        schedule(options.scope, {
            callback,
            inEffect,
            outEffect,
            coverTransition,
            revealTransition,
            resolve,
            reject,
            settled: false,
        })
    })
}

export * from "./types"
export * from "./effects"
