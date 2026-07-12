import { ELEMENT_CLASS } from "../class-names"
import { BoxSize, TileOrder } from "../types"

export interface Grid {
    tiles: HTMLElement[]
    rows: number
    cols: number
}

/** Number of tiles needed to cover `length` px at `size` px each (min 1). */
export function countFor(length: number, size: number): number {
    return Math.max(1, Math.ceil(length / size))
}

/** A tile dimension: a px `number`, a `"50%"` fraction of the box axis it
 *  tiles, or a `"100px"`-style length string. */
export type TileSize = number | string

/** Normalise a `size` option to `[width, height]` tile dimensions. */
export function resolveSize(
    size: TileSize | [TileSize, TileSize]
): [TileSize, TileSize] {
    return Array.isArray(size) ? size : [size, size]
}

/** Resolve a tile dimension to px against the box `length` it tiles: a number
 *  is px as-is, a `"50%"` string is that fraction of `length`, any other unit
 *  string (`"100px"`) is parsed as px. */
export function tilePx(size: TileSize, length: number): number {
    if (typeof size === "number") return size
    const value = parseFloat(size)
    return size.trim().endsWith("%") ? (value / 100) * length : value
}

/**
 * Build a CSS grid of targetable tiles that fully tiles the container,
 * starting hidden (`opacity: 0`) so the page shows through until cover begins.
 */
export function createGrid(
    container: HTMLElement,
    rows: number,
    cols: number,
    initialOpacity = "0"
): Grid {
    const wrapper = document.createElement("div")
    const ws = wrapper.style
    ws.position = "absolute"
    ws.inset = "0"
    ws.display = "grid"
    ws.gridTemplateColumns = `repeat(${cols}, 1fr)`
    ws.gridTemplateRows = `repeat(${rows}, 1fr)`

    const tiles: HTMLElement[] = []
    for (let i = 0; i < rows * cols; i++) {
        const tile = document.createElement("div")
        tile.className = ELEMENT_CLASS
        tile.style.opacity = initialOpacity
        tile.style.willChange = "opacity"
        wrapper.appendChild(tile)
        tiles.push(tile)
    }

    container.appendChild(wrapper)

    return { tiles, rows, cols }
}

function shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const swap = items[i]
        items[i] = items[j]
        items[j] = swap
    }
    return items
}

/**
 * Reorder row-major tiles into the activation sequence named by `order`.
 * The returned order is what `stagger()` walks, so it controls the look of
 * the fill (and is reversed for the reveal when desired).
 */
export function orderTiles(grid: Grid, order: TileOrder): HTMLElement[] {
    const { tiles, cols, rows } = grid

    if (order === "rows") return tiles.slice()
    if (order === "random") return shuffle(tiles.slice())

    const indexed = tiles.map((el, i) => ({
        el,
        r: Math.floor(i / cols),
        c: i % cols,
    }))

    if (order === "columns") {
        indexed.sort((a, b) => a.c - b.c || a.r - b.r)
    } else if (order === "diagonal") {
        indexed.sort((a, b) => a.r + a.c - (b.r + b.c))
    } else {
        // radial: nearest-to-centre first
        const cr = (rows - 1) / 2
        const cc = (cols - 1) / 2
        const dist = (p: { r: number; c: number }) =>
            Math.hypot(p.r - cr, p.c - cc)
        indexed.sort((a, b) => dist(a) - dist(b))
    }

    return indexed.map((p) => p.el)
}

/**
 * Per-tile activation fractions in `[0, 1]` for a *directional* sweep — the
 * fraction of the stagger window at which each tile flips. Unlike `orderTiles`,
 * which ranks tiles into a 1-D sequence, this projects each tile's centre onto
 * an arbitrary angle, so tiles sharing a wavefront fire together: a 90° (down)
 * sweep flips a whole row at once, giving a hard horizontal edge.
 *
 * `angle` is in degrees, matching `wipe`: 0 = → (right), 90 = ↓ (down), 180 =
 * ← (left), 270 = ↑ (up). Centres are projected in px (against `box`) so the
 * edge sits at the true on-screen angle, not the grid's cell aspect ratio.
 *
 * `noise` (0–1) softens that hard edge by blending each fraction toward a
 * random one: 0 keeps the straight wavefront, 1 is fully random (matching
 * `order: "random"`), and values between dither the edge into a soft band.
 */
export function directionFractions(
    grid: Grid,
    box: BoxSize,
    angle: number,
    noise = 0
): number[] {
    const { tiles, rows, cols } = grid
    const radians = (angle * Math.PI) / 180
    const dx = Math.cos(radians)
    const dy = Math.sin(radians)
    const tileW = box.width / cols
    const tileH = box.height / rows

    // project each tile centre onto the sweep direction
    let min = Infinity
    let max = -Infinity
    const projections = new Array<number>(tiles.length)
    for (let i = 0; i < tiles.length; i++) {
        const x = ((i % cols) + 0.5) * tileW
        const y = (Math.floor(i / cols) + 0.5) * tileH
        const p = x * dx + y * dy
        projections[i] = p
        if (p < min) min = p
        if (p > max) max = p
    }

    // normalise so the trailing edge is 0 and the leading edge 1, then blend
    // toward randomness by `noise` (a convex mix, so the result stays in [0,1])
    const span = max - min || 1
    const mix = Math.min(1, Math.max(0, noise))
    const fractions = new Array<number>(tiles.length)
    for (let i = 0; i < tiles.length; i++) {
        const clean = (projections[i] - min) / span
        fractions[i] = clean * (1 - mix) + Math.random() * mix
    }
    return fractions
}
