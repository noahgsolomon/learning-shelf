import { Direction, DirectionMode } from "../types"

const OPPOSITE: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
}

const ORIGIN: Record<Direction, string> = {
    left: "left center",
    right: "right center",
    up: "center top",
    down: "center bottom",
}

export function opposite(direction: Direction): Direction {
    return OPPOSITE[direction]
}

export function isHorizontal(direction: Direction): boolean {
    return direction === "left" || direction === "right"
}

/** The `transform-origin` for a panel anchored to the given edge. */
export function originFor(direction: Direction): string {
    return ORIGIN[direction]
}

export interface ResolvedDirections {
    /** The direction the curtain travels as it covers. */
    cover: Direction
    /** The direction the curtain travels as it reveals. */
    reveal: Direction
}

/**
 * Resolve the cover/reveal directions from the public `direction` option.
 *
 * - A single `Direction` covers that way; `directionMode` decides whether the
 *   reveal continues (`"normal"`) or retreats (`"reverse"`).
 * - A `[cover, reveal]` tuple sets each phase explicitly.
 */
export function resolveDirections(
    direction: Direction | [Direction, Direction] = "right",
    directionMode: DirectionMode = "normal"
): ResolvedDirections {
    if (Array.isArray(direction)) {
        return { cover: direction[0], reveal: direction[1] }
    }

    return {
        cover: direction,
        reveal: directionMode === "reverse" ? opposite(direction) : direction,
    }
}
