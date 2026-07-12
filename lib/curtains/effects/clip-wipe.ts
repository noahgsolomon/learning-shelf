import { animate } from "motion/mini"
import { warning } from "motion-utils"
import { isHorizontal, resolveDirections } from "../utils/directions"
import { resolveTransition } from "../utils/transition"
import { CurtainEffect, Direction, DirectionalOptions } from "../types"
import { boxSize, createPanel } from "./utils"

export interface ClipWipeOptions extends DirectionalOptions {
    /** Tilt of the wipe edge, in degrees (0 = straight). */
    angle?: number
    /**
     * Bow the leading edge into a convex curve that pulls out ahead in the
     * middle, as a fraction of the box along the travel axis (0 = straight,
     * ~0.15 = a gentle arc). Takes precedence over `angle`.
     */
    bow?: number
}

/** A clip coordinate of `pct%` plus a `px` slant offset. */
function len(pct: number, px: number): string {
    const p = Math.round(pct * 100) / 100
    const x = Math.round(px)
    if (x === 0) return `${p}%`
    if (p === 0) return `${x}px`
    return `calc(${p}% + ${x}px)`
}

/**
 * Polygon for the region *behind* the leading edge (the effect's origin side).
 * `p` runs 0 (nothing covered) → 1 (fully covered). `shear` is the slant in px
 * across the perpendicular axis.
 */
function coverPolygon(direction: Direction, p: number, shear: number): string {
    const main = p * 100
    const a = -shear * (1 - p)
    const b = shear * p
    switch (direction) {
        case "right":
            return `0% 0%, ${len(main, a)} 0%, ${len(main, b)} 100%, 0% 100%`
        case "left":
            return `100% 0%, ${len(100 - main, -a)} 0%, ${len(100 - main, -b)} 100%, 100% 100%`
        case "down":
            return `0% 0%, 100% 0%, 100% ${len(main, b)}, 0% ${len(main, a)}`
        default: // up
            return `0% 100%, 100% 100%, 100% ${len(100 - main, -b)}, 0% ${len(100 - main, -a)}`
    }
}

/**
 * Polygon for the region *ahead* of the trailing edge — used for a continuing
 * reveal, where the covered area shrinks in the cover's direction.
 */
function revealPolygon(direction: Direction, p: number, shear: number): string {
    const main = p * 100
    const a = -shear * (1 - p)
    const b = shear * p
    switch (direction) {
        case "right":
            return `${len(main, a)} 0%, 100% 0%, 100% 100%, ${len(main, b)} 100%`
        case "left":
            return `${len(100 - main, -a)} 0%, 0% 0%, 0% 100%, ${len(100 - main, -b)} 100%`
        case "down":
            return `0% ${len(main, a)}, 100% ${len(main, b)}, 100% 100%, 0% 100%`
        default: // up
            return `0% ${len(100 - main, -a)}, 100% ${len(100 - main, -b)}, 100% 0%, 0% 0%`
    }
}

const poly = (points: string) => `polygon(${points})`
const path = (d: string) => `path("${d}")`

/** Round to 1dp to keep the path string (and bundle) small. */
const r = (x: number) => Math.round(x * 10) / 10

/**
 * `path()` for the covered region behind a leading edge that bows out into a
 * quadratic curve. `p` 0 → 1 = nothing → fully covered; `bulge` is the convex
 * depth in px (control point is 2×, since a quadratic reaches half way to it).
 * Coords are px, so the box `w`×`h` must be measured.
 */
function coverPath(
    direction: Direction,
    p: number,
    bulge: number,
    w: number,
    h: number
): string {
    const c = 2 * bulge
    switch (direction) {
        case "down": {
            const y = -bulge + p * (h + bulge)
            return `M 0 0 L ${r(w)} 0 L ${r(w)} ${r(y)} Q ${r(w / 2)} ${r(y + c)} 0 ${r(y)} Z`
        }
        case "up": {
            const y = (h + bulge) * (1 - p)
            return `M 0 ${r(h)} L ${r(w)} ${r(h)} L ${r(w)} ${r(y)} Q ${r(w / 2)} ${r(y - c)} 0 ${r(y)} Z`
        }
        case "right": {
            const x = -bulge + p * (w + bulge)
            return `M 0 0 L ${r(x)} 0 Q ${r(x + c)} ${r(h / 2)} ${r(x)} ${r(h)} L 0 ${r(h)} Z`
        }
        default: {
            // left
            const x = (w + bulge) * (1 - p)
            return `M ${r(w)} 0 L ${r(x)} 0 Q ${r(x - c)} ${r(h / 2)} ${r(x)} ${r(h)} L ${r(w)} ${r(h)} Z`
        }
    }
}

/** As `coverPath`, but the covered region is *ahead* of the (same-shaped)
 *  trailing edge — used for a continuing reveal. */
function revealPath(
    direction: Direction,
    p: number,
    bulge: number,
    w: number,
    h: number
): string {
    const c = 2 * bulge
    switch (direction) {
        case "down": {
            const y = -bulge + p * (h + bulge)
            return `M 0 ${r(y)} Q ${r(w / 2)} ${r(y + c)} ${r(w)} ${r(y)} L ${r(w)} ${r(h)} L 0 ${r(h)} Z`
        }
        case "up": {
            const y = (h + bulge) * (1 - p)
            return `M 0 ${r(y)} Q ${r(w / 2)} ${r(y - c)} ${r(w)} ${r(y)} L ${r(w)} 0 L 0 0 Z`
        }
        case "right": {
            const x = -bulge + p * (w + bulge)
            return `M ${r(x)} 0 Q ${r(x + c)} ${r(h / 2)} ${r(x)} ${r(h)} L ${r(w)} ${r(h)} L ${r(w)} 0 Z`
        }
        default: {
            // left
            const x = (w + bulge) * (1 - p)
            return `M ${r(x)} 0 Q ${r(x - c)} ${r(h / 2)} ${r(x)} ${r(h)} L 0 ${r(h)} L 0 0 Z`
        }
    }
}

/**
 * A wipe whose edge is a clip on a *static* overlay — the element never moves,
 * so it's ideal for revealing fixed content (an image, gradient, poster).
 * Supports any direction, `directionMode`, and an exact `angle` (no oversize,
 * no wasted travel) via a slanted polygon edge.
 */
export function clipWipe(options: ClipWipeOptions = {}): CurtainEffect {
    const { direction, directionMode, angle = 0 } = options
    const bow = Math.max(0, options.bow ?? 0)
    const { cover, reveal } = resolveDirections(direction, directionMode)

    warning(
        isHorizontal(cover) === isHorizontal(reveal),
        "curtains: clipWipe can't reveal on a different axis than it covers; the reveal direction is ignored"
    )
    warning(
        !(bow > 0 && angle !== 0),
        "curtains: clipWipe ignores `angle` when `bow` is set"
    )

    const continueReveal = reveal === cover

    let frames: {
        coverFrom: string
        coverTo: string
        revealFrom: string
        revealTo: string
    }
    let overlay: HTMLElement

    return {
        setup(container, box) {
            overlay = createPanel("clip-path")

            const { width, height } = boxSize(container, box)

            if (bow > 0) {
                // curved leading edge via path() (px coords, so measure the box)
                const bulge = bow * (isHorizontal(cover) ? width : height)
                const coverFrom = path(coverPath(cover, 0, bulge, width, height))
                const coverTo = path(coverPath(cover, 1, bulge, width, height))
                frames = {
                    coverFrom,
                    coverTo,
                    revealFrom: continueReveal
                        ? path(revealPath(cover, 0, bulge, width, height))
                        : coverTo,
                    revealTo: continueReveal
                        ? path(revealPath(cover, 1, bulge, width, height))
                        : coverFrom,
                }
            } else {
                const perp = isHorizontal(cover) ? height : width
                // magnitude only: the polygon slant always extends outward so
                // the overlay fully covers. (A negative angle thus leans the
                // same way as a positive one rather than inverting — and never
                // exposes a corner, which a signed shear would.)
                const shear = Math.abs(Math.tan((angle * Math.PI) / 180) * perp)

                const coverFrom = poly(coverPolygon(cover, 0, shear))
                const coverTo = poly(coverPolygon(cover, 1, shear))
                frames = {
                    coverFrom,
                    coverTo,
                    revealFrom: continueReveal
                        ? poly(revealPolygon(cover, 0, shear))
                        : coverTo,
                    revealTo: continueReveal
                        ? poly(revealPolygon(cover, 1, shear))
                        : coverFrom,
                }
            }

            overlay.style.clipPath = frames.coverFrom
            container.appendChild(overlay)
        },
        cover(transition) {
            return animate(
                overlay,
                { clipPath: [frames.coverFrom, frames.coverTo] },
                resolveTransition(transition)
            )
        },
        reveal(transition) {
            return animate(
                overlay,
                { clipPath: [frames.revealFrom, frames.revealTo] },
                resolveTransition(transition)
            )
        },
    }
}
