import { isHorizontal } from "../utils/directions"
import { CurtainEffect, Direction, DirectionMode } from "../types"
import { scaleStripsEffect } from "./strips"

export interface StaggerWipeOptions {
    /** Strip thickness in px. */
    size?: number
    /** The direction the wipe travels. Defaults to `"down"`. */
    direction?: Direction
    directionMode?: DirectionMode
}

/**
 * Strips that each wipe in `direction`, staggered across the perpendicular
 * axis — a cascading wipe. The reveal continues in the cover's direction
 * rather than springing back.
 */
export function staggerWipe(options: StaggerWipeOptions = {}): CurtainEffect {
    const { size = 120, direction = "down", directionMode = "normal" } = options

    return scaleStripsEffect({
        size,
        // strips run across the wipe (⊥): a vertical wipe → columns, a
        // horizontal wipe → rows
        stripAxis: isHorizontal(direction) ? "y" : "x",
        direction,
        directionMode,
    })
}
