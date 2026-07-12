import { animate } from "motion/mini"
import { resolveTransition } from "../utils/transition"
import { CurtainEffect } from "../types"
import { boxSize, createPanel } from "./utils"

export interface IrisOptions {
    /**
     * Where the circle grows from. Numbers are 0–1 fractions of the box (like
     * Motion's `originX`/`originY`), so the default `{ x: 0.5, y: 0.5 }` is the
     * centre and a click-origin wipe is `{ x: clientX / innerWidth, ... }`.
     * Strings pass through as CSS lengths, e.g. `{ x: "100px", y: "50%" }`.
     */
    origin?: { x: number | string; y: number | string }
}

const coord = (value: number | string): string =>
    typeof value === "number" ? `${value * 100}%` : value

/** Resolve an origin coord to px along an axis of the given length. */
const toPx = (value: number | string, length: number): number => {
    if (typeof value === "number") return value * length
    if (value.endsWith("%")) return (parseFloat(value) / 100) * length
    return parseFloat(value)
}

/** A circular clip that expands to cover, then contracts to reveal. */
export function iris(options: IrisOptions = {}): CurtainEffect {
    const { origin = { x: 0.5, y: 0.5 } } = options
    const at = `${coord(origin.x)} ${coord(origin.y)}`

    let panel: HTMLElement
    let hidden: string
    let shown: string
    return {
        setup(container, box) {
            const { width, height } = boxSize(container, box)
            // Size the covering circle to the exact distance from the origin to
            // its farthest corner — the smallest radius that fully hides the
            // box. A fixed 150% over-grows for most origins (a centred one is
            // covered by ~71%), so the clip keeps expanding after the page is
            // already hidden — reading as dead time at the end of the cover and
            // a late start to the reveal. Measuring keeps the perceived speed
            // constant whatever the origin, the box covered just as it lands.
            const ox = toPx(origin.x, width)
            const oy = toPx(origin.y, height)
            const radius = Math.hypot(
                Math.max(ox, width - ox),
                Math.max(oy, height - oy)
            )
            // px (not %) so both keyframes share a unit and interpolate cleanly.
            hidden = `circle(0px at ${at})`
            shown = `circle(${radius}px at ${at})`

            panel = createPanel("clip-path")
            panel.style.clipPath = hidden
            container.appendChild(panel)
        },
        cover(transition) {
            return animate(panel, { clipPath: [hidden, shown] }, resolveTransition(transition))
        },
        reveal(transition) {
            return animate(panel, { clipPath: [shown, hidden] }, resolveTransition(transition))
        },
    }
}
