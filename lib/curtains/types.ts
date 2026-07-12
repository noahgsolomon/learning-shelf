import { Transition } from "motion-dom"

export type Direction = "up" | "down" | "left" | "right"

/**
 * Whether the reveal continues in the cover's direction of travel
 * (`"normal"` — a sweep-through) or retreats back the way it came
 * (`"reverse"` — a door that opens and closes).
 */
export type DirectionMode = "normal" | "reverse"

/**
 * The spatial sequence in which a grid of tiles activates. `stagger()`
 * then resolves the per-tile delay along this sequence.
 */
export type TileOrder = "rows" | "columns" | "diagonal" | "radial" | "random"

/**
 * The minimal animation surface curtains needs to await and abort a phase.
 * Satisfied by Motion's mini `animate` controls and our `combine` helper.
 */
export interface CurtainAnimation {
    finished: Promise<unknown>
    stop: () => void
}

/** The measured size of the overlay's container, used to size effects. */
export interface BoxSize {
    width: number
    height: number
}

export interface CurtainEffect {
    /**
     * Build the overlay DOM inside the container and keep a handle to whatever
     * `cover`/`reveal` animate. `box` is the container's measured size —
     * effects must size from it (not `window`) so they work when scoped to an
     * element.
     */
    setup: (container: HTMLElement, box?: BoxSize) => void
    /** Animate the overlay in until it fully occludes the viewport. */
    cover: (transition?: Transition) => CurtainAnimation
    /** Animate the overlay back out to reveal the freshly swapped content. */
    reveal: (transition?: Transition) => CurtainAnimation
}

export type CurtainEffectFactory = () => CurtainEffect

/**
 * The DOM-mutating callback run while the page is fully covered — swap
 * content, change route, await fonts/data. Resolves before the reveal.
 */
export type CurtainsCallback = () => void | Promise<void>

/**
 * A value applied to both phases, or a `[cover, reveal]` tuple that sets each
 * phase independently — the same shape as the directional `direction` option.
 */
export type Pair<T> = T | [T, T]

export interface CurtainsOptions {
    /**
     * The transition effect. Pass a configured effect (`wipe({ ... })`) or the
     * factory itself (`wipe`) to use its defaults. A `[in, out]` tuple mixes a
     * different effect for the reveal — e.g. `[wipe({ direction: "left" }),
     * iris()]`. Defaults to `fade`.
     */
    effect?: Pair<CurtainEffect | CurtainEffectFactory>
    /**
     * Animation timing. A single `Transition` times both phases; a `[cover,
     * reveal]` tuple times each independently. When an effect animates multiple
     * elements, `delay: stagger()` resolves per element in turn.
     */
    transition?: Pair<Transition>
    /**
     * Scope the transition to a single element instead of the whole viewport.
     * The overlay mounts inside it (so it follows scroll and tracks the box
     * via `inset: 0`) rather than the top layer. The element must establish a
     * containing block — i.e. be positioned (`relative`/`absolute`/etc.).
     */
    scope?: HTMLElement
}

/** Shared options consumed by direction-aware effects. */
export interface DirectionalOptions {
    direction?: Direction | [Direction, Direction]
    directionMode?: DirectionMode
}
