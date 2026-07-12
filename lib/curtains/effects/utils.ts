import { ELEMENT_CLASS } from "../class-names"
import { BoxSize, CurtainAnimation } from "../types"

/**
 * The size an effect should build against. Prefers the box measured by the
 * orchestrator; falls back to measuring the container (with a viewport
 * default for environments like jsdom where the rect reads 0).
 */
export function boxSize(container: HTMLElement, box?: BoxSize): BoxSize {
    if (box) return box
    const rect = container.getBoundingClientRect()
    return {
        width: rect.width || window.innerWidth,
        height: rect.height || window.innerHeight,
    }
}

/** An absolutely-positioned, targetable panel filling its container. */
export function createPanel(willChange = "transform"): HTMLDivElement {
    const panel = document.createElement("div")
    panel.className = ELEMENT_CLASS
    const s = panel.style
    s.position = "absolute"
    s.inset = "0"
    s.width = "100%"
    s.height = "100%"
    s.willChange = willChange
    return panel
}

/**
 * Present several animations as a single awaitable/abortable phase, without
 * pulling in a heavier group-animation construct.
 */
export function combine(animations: CurtainAnimation[]): CurtainAnimation {
    if (animations.length === 1) return animations[0]

    return {
        finished: Promise.all(animations.map((a) => a.finished)),
        stop() {
            for (const animation of animations) animation.stop()
        },
    }
}
