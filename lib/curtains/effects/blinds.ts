import { CurtainEffect, DirectionMode } from "../types"
import { scaleStripsEffect } from "./strips"

export interface BlindsOptions {
    /** Slat thickness in px. */
    size?: number
    /** Slat layout: `"row"` → horizontal slats; `"column"` → vertical slats. */
    direction?: "row" | "column"
    directionMode?: DirectionMode
}

/**
 * Venetian-blind slats that scale shut to cover, then open to reveal. Each
 * slat scales along its own stacking axis (so the slats thin out). The reveal
 * flips each slat's origin so they continue past rather than spring back.
 */
export function blinds(options: BlindsOptions = {}): CurtainEffect {
    const { size = 64, direction = "row", directionMode = "normal" } = options
    const column = direction === "column"

    return scaleStripsEffect({
        size,
        // a slat scales along the axis it's stacked on (∥): rows scale down,
        // columns scale across
        stripAxis: column ? "x" : "y",
        direction: column ? "right" : "down",
        directionMode,
    })
}
