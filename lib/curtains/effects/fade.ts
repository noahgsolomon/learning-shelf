import { animate } from "motion/mini"
import { resolveTransition } from "../utils/transition"
import { CurtainEffect } from "../types"
import { createPanel } from "./utils"

/** A solid panel that fades in, hides the swap, then fades back out. */
export function fade(): CurtainEffect {
    let panel: HTMLElement
    return {
        setup(container) {
            panel = createPanel("opacity")
            panel.style.opacity = "0"
            container.appendChild(panel)
        },
        cover(transition) {
            return animate(panel, { opacity: [0, 1] }, resolveTransition(transition))
        },
        reveal(transition) {
            return animate(panel, { opacity: [1, 0] }, resolveTransition(transition))
        },
    }
}
