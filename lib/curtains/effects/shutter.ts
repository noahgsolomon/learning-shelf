import { animate } from "motion/mini"
import { countFor } from "../utils/tiles"
import { resolveTransition } from "../utils/transition"
import { CurtainEffect } from "../types"
import { boxSize, combine } from "./utils"
import { createStrips } from "./strips"

export interface ShutterOptions {
    /** Column width in px. */
    size?: number
}

// Slightly past the edge so a column is fully off-screen before it slides in.
const UP = "translateY(-101%)"
const DOWN = "translateY(101%)"
const HOME = "translateY(0%)"

/** Interleaved columns that slide in from alternating top and bottom. */
export function shutter(options: ShutterOptions = {}): CurtainEffect {
    const { size = 120 } = options
    let groups: { even: HTMLElement[]; odd: HTMLElement[] }

    return {
        setup(container, box) {
            const { width } = boxSize(container, box)
            const strips = createStrips(container, countFor(width, size), "x")
            const even: HTMLElement[] = []
            const odd: HTMLElement[] = []
            strips.forEach((strip, i) => (i % 2 ? odd : even).push(strip))
            for (const strip of even) strip.style.transform = UP
            for (const strip of odd) strip.style.transform = DOWN
            groups = { even, odd }
        },
        cover(transition) {
            const t = resolveTransition(transition)
            return combine([
                animate(groups.even, { transform: [UP, HOME] }, t),
                animate(groups.odd, { transform: [DOWN, HOME] }, t),
            ])
        },
        reveal(transition) {
            const t = resolveTransition(transition)
            return combine([
                animate(groups.even, { transform: [HOME, UP] }, t),
                animate(groups.odd, { transform: [HOME, DOWN] }, t),
            ])
        },
    }
}
