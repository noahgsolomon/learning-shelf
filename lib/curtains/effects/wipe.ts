import { animate } from "motion/mini"
import { warning } from "motion-utils"
import { isHorizontal, resolveDirections } from "../utils/directions"
import { resolveTransition } from "../utils/transition"
import { ELEMENT_CLASS } from "../class-names"
import { CurtainEffect, DirectionalOptions } from "../types"
import { boxSize } from "./utils"

export interface WipeOptions extends DirectionalOptions {
    /** Tilt of the wipe edge, in degrees (0 = straight). */
    angle?: number
}

/**
 * A solid panel that sweeps across the viewport. With an `angle` the leading
 * edge is skewed — the panel is oversized by *exactly* the skew shear and
 * centred, so it travels precisely one panel-width with no wasted (invisible)
 * travel. By default the reveal continues in the cover's direction; `direction
 * Mode: "reverse"` makes it retreat like a closing door.
 */
export function wipe(options: WipeOptions = {}): CurtainEffect {
    const { direction, directionMode, angle = 0 } = options
    const { cover, reveal } = resolveDirections(direction, directionMode)

    warning(
        isHorizontal(cover) === isHorizontal(reveal),
        "curtains: wipe can't reveal on a different axis than it covers; the reveal direction is ignored"
    )

    const horizontal = isHorizontal(cover)
    const translate = horizontal ? "translateX" : "translateY"
    const skew = `${horizontal ? "skewX" : "skewY"}(${angle}deg)`

    // Travel of one panel-width covers the viewport plus the slant exactly.
    const forward = cover === "right" || cover === "down"
    const enter = forward ? "-100%" : "100%"
    const exit = forward ? "100%" : "-100%"

    const at = (offset: string) => `${translate}(${offset}) ${skew}`
    const coverFrom = at(enter)
    const coverTo = at("0%")
    // continue past on a normal reveal, retreat to the entry on a reverse one
    const revealTo = at(reveal === cover ? exit : enter)

    let panel: HTMLElement
    return {
        setup(container, box) {
            // measure the container, not the viewport, so an angled wipe sizes
            // its shear to the actual box (correct when scoped to an element)
            const { width, height } = boxSize(container, box)
            const perp = horizontal ? height : width
            // size by the shear's magnitude (a negative angle leans the other
            // way via the signed skew, but must still oversize outward)
            const overshoot = Math.abs(Math.tan((angle * Math.PI) / 180) * perp)

            panel = document.createElement("div")
            panel.className = ELEMENT_CLASS
            Object.assign(panel.style, {
                position: "absolute",
                willChange: "transform",
                transform: coverFrom,
                // oversize by the shear and centre it so the skewed corners
                // still cover every edge
                top: horizontal ? "0px" : `${-overshoot / 2}px`,
                left: horizontal ? `${-overshoot / 2}px` : "0px",
                width: horizontal ? `calc(100% + ${overshoot}px)` : "100%",
                height: horizontal ? "100%" : `calc(100% + ${overshoot}px)`,
            })
            container.appendChild(panel)
        },
        cover(transition) {
            return animate(
                panel,
                { transform: [coverFrom, coverTo] },
                resolveTransition(transition)
            )
        },
        reveal(transition) {
            return animate(
                panel,
                { transform: [coverTo, revealTo] },
                resolveTransition(transition)
            )
        },
    }
}
