/**
 * Whether the user has asked to minimise motion. Curtains honours this by
 * swapping content with no transition at all.
 */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
}
