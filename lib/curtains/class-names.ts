/**
 * Class on the overlay container. Target it to position/theme the curtain
 * host (e.g. `.motion-curtains { z-index: 999 }`).
 */
export const CONTAINER_CLASS = "motion-curtains"

/**
 * Class on every covering element (panel, tile, strip, door). Target it to
 * style the curtain's fill — `.motion-curtain { background: ... }`. A default
 * dark fill is injected at the top of <head>, so author styles override it.
 */
export const ELEMENT_CLASS = "motion-curtain"

/** Default fill applied to `.motion-curtain` unless overridden by author CSS. */
export const DEFAULT_FILL = "#0b0b0c"
