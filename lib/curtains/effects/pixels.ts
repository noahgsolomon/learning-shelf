import { animate } from "motion/mini"
import {
    countFor,
    createGrid,
    directionFractions,
    orderTiles,
    resolveSize,
    tilePx,
    TileSize,
} from "../utils/tiles"
import { resolveTileTransition, tileDelayTransition } from "../utils/transition"
import { CurtainEffect, DirectionMode, TileOrder } from "../types"
import { boxSize } from "./utils"

export interface PixelsOptions {
    /** Tile edge length: px (`100`), a `"50%"` fraction of the box, or
     *  `[width, height]` for rectangular tiles. */
    size?: TileSize | [TileSize, TileSize]
    /** Activation sequence the stagger walks. Ignored when `direction` is set. */
    order?: TileOrder
    /**
     * Sweep the fill across the grid as a directional wavefront, angled in
     * degrees like `wipe`: 0 = → (right), 90 = ↓ (down), 180 = ← (left), 270 =
     * ↑ (up). Tiles sharing the wavefront flip together (a 90° sweep flips a
     * whole row at once), so the edge reads as a hard line. Takes precedence
     * over `order`. Soften the edge with `noise`.
     */
    direction?: number
    /**
     * Softens a `direction` sweep's leading edge, 0–1. `0` keeps a hard,
     * straight wavefront; higher values jitter each tile's timing so the edge
     * dithers into a soft band; `1` is fully random (like `order: "random"`).
     */
    noise?: number
    /** Whether the reveal replays the order/sweep or runs it in reverse. */
    directionMode?: DirectionMode
}

/** A grid of tiles that fill in to cover, then clear out to reveal. */
export function pixels(options: PixelsOptions = {}): CurtainEffect {
    const {
        size = 100,
        order = "random",
        direction,
        noise = 0,
        directionMode = "normal",
    } = options
    const [sizeW, sizeH] = resolveSize(size)
    const directional = direction !== undefined

    // Either an explicit activation sequence (order-based) or a row-major tile
    // list paired with per-tile delay fractions (direction-based).
    let sequence: HTMLElement[] = []
    let fractions: number[] = []

    return {
        setup(container, box) {
            const dims = boxSize(container, box)
            const cols = countFor(dims.width, tilePx(sizeW, dims.width))
            const rows = countFor(dims.height, tilePx(sizeH, dims.height))
            const grid = createGrid(container, rows, cols)
            if (directional) {
                sequence = grid.tiles
                fractions = directionFractions(grid, dims, direction, noise)
            } else {
                sequence = orderTiles(grid, order)
            }
        },
        cover(transition) {
            const resolved = directional
                ? tileDelayTransition(transition, fractions)
                : resolveTileTransition(transition, sequence.length)
            return animate(sequence, { opacity: [0, 1] }, resolved)
        },
        reveal(transition) {
            if (directional) {
                // continue the sweep (trailing edge clears first) on normal;
                // retreat it (leading edge clears first) on reverse
                const out =
                    directionMode === "reverse"
                        ? fractions.map((f) => 1 - f)
                        : fractions
                return animate(
                    sequence,
                    { opacity: [1, 0] },
                    tileDelayTransition(transition, out)
                )
            }
            const out =
                directionMode === "reverse"
                    ? sequence.slice().reverse()
                    : sequence
            return animate(
                out,
                { opacity: [1, 0] },
                resolveTileTransition(transition, out.length)
            )
        },
    }
}
