import { animate } from "motion/mini"
import { isHorizontal, originFor, opposite, resolveDirections } from "../utils/directions"
import { countFor } from "../utils/tiles"
import { resolveTileTransition } from "../utils/transition"
import { ELEMENT_CLASS } from "../class-names"
import { CurtainEffect, Direction, DirectionMode } from "../types"
import { boxSize } from "./utils"

/**
 * Build `count` equal strips along an axis (`x` → columns) and attach them to
 * the container in a single insertion (via a fragment, so no wrapper node is
 * left behind). Strips are absolutely positioned and overlap by 1px so
 * sub-pixel rounding can't open seams between them while they cover.
 */
export function createStrips(
    container: HTMLElement,
    count: number,
    stripAxis: "x" | "y"
): HTMLElement[] {
    const fragment = document.createDocumentFragment()
    const pct = 100 / count
    const strips: HTMLElement[] = []
    for (let i = 0; i < count; i++) {
        const strip = document.createElement("div")
        strip.className = ELEMENT_CLASS
        const s = strip.style
        s.position = "absolute"
        s.willChange = "transform"
        if (stripAxis === "x") {
            s.top = "0"
            s.height = "100%"
            s.left = `${i * pct}%`
            s.width = `calc(${pct}% + 1px)`
        } else {
            s.left = "0"
            s.width = "100%"
            s.top = `${i * pct}%`
            s.height = `calc(${pct}% + 1px)`
        }
        fragment.appendChild(strip)
        strips.push(strip)
    }

    container.appendChild(fragment)
    return strips
}

export interface ScaleStripsConfig {
    size: number
    /** Arrangement axis: `x` → columns staggered left→right. */
    stripAxis: "x" | "y"
    /** The direction each strip scales/wipes — sets the scale axis and the
     *  cover/reveal origins (reveal flips to continue, like `wipe`). */
    direction: Direction
    directionMode: DirectionMode
}

/**
 * Shared implementation for strip effects that cover by scaling each strip
 * from an edge, staggered along the arrangement axis. The reveal flips the
 * transform-origin so the strips continue in the cover's direction rather
 * than springing back.
 */
export function scaleStripsEffect(config: ScaleStripsConfig): CurtainEffect {
    const { size, stripAxis, direction, directionMode } = config
    const { cover, reveal } = resolveDirections(direction, directionMode)

    const scaleAxis = isHorizontal(direction) ? "scaleX" : "scaleY"
    const coverOrigin = originFor(opposite(cover))
    const revealOrigin = originFor(reveal)
    const hidden = `${scaleAxis}(0)`
    const shown = `${scaleAxis}(1)`

    let strips: HTMLElement[]

    return {
        setup(container, box) {
            const { width, height } = boxSize(container, box)
            const length = stripAxis === "x" ? width : height
            strips = createStrips(container, countFor(length, size), stripAxis)
            for (const strip of strips) {
                strip.style.transformOrigin = coverOrigin
                strip.style.transform = hidden
            }
        },
        cover(transition) {
            return animate(
                strips,
                { transform: [hidden, shown] },
                resolveTileTransition(transition, strips.length)
            )
        },
        reveal(transition) {
            for (const strip of strips) {
                strip.style.transformOrigin = revealOrigin
            }
            // reverse the stagger order on reverse mode, matching pixels
            const out =
                directionMode === "reverse" ? strips.slice().reverse() : strips
            return animate(
                out,
                { transform: [shown, hidden] },
                resolveTileTransition(transition, out.length)
            )
        },
    }
}
