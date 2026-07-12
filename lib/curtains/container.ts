import { warning } from "motion-utils"
import { CONTAINER_CLASS, DEFAULT_FILL, ELEMENT_CLASS } from "./class-names"

const STYLE_ID = "motion-curtains-style"
const ATTR = "data-motion-curtains"

/**
 * Inject the one-time defaults: the curtain's fallback fill (overridable via
 * `.motion-curtain` author CSS) and a transparent popover backdrop. Inserted
 * at the top of <head> so author styles win the cascade.
 */
function injectStyle(): void {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
        return
    }

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent =
        `.${ELEMENT_CLASS}{background:${DEFAULT_FILL};}` +
        `[${ATTR}]::backdrop{background:transparent;}`
    document.head.insertBefore(style, document.head.firstChild)
}

export interface CurtainsContainer {
    element: HTMLElement
    remove: () => void
}

function createOverlay(styles: Partial<CSSStyleDeclaration>): HTMLElement {
    // inject the default fill regardless of overlay kind (viewport or scoped)
    injectStyle()

    const element = document.createElement("div")
    element.className = CONTAINER_CLASS
    element.setAttribute(ATTR, "")
    // decorative only — keep it out of the accessibility tree
    element.setAttribute("aria-hidden", "true")
    Object.assign(element.style, styles)
    return element
}

/**
 * Viewport overlay: a `<div>` promoted to the top layer via the Popover API,
 * above all page content without trapping focus or inerting the page (unlike
 * a modal dialog). Falls back to a max-z overlay where popovers aren't
 * supported (jsdom, older browsers).
 */
export function createContainer(): CurtainsContainer {
    const element = createOverlay({
        position: "fixed",
        margin: "0",
        padding: "0",
        border: "0",
        inset: "0",
        width: "100vw",
        height: "100vh",
        maxWidth: "none",
        maxHeight: "none",
        background: "transparent",
        overflow: "hidden",
    })
    element.setAttribute("popover", "manual")

    document.body.appendChild(element)

    try {
        ;(element as unknown as { showPopover(): void }).showPopover()
    } catch {
        element.style.zIndex = "2147483647"
    }

    return {
        element,
        remove() {
            try {
                ;(element as unknown as { hidePopover(): void }).hidePopover()
            } catch {
                // never shown / unsupported
            }
            element.remove()
        },
    }
}

/**
 * Element-scoped overlay: a `position: absolute; inset: 0` `<div>` mounted
 * inside `scope`, so it covers and tracks that element (following scroll and
 * resizing with the box) instead of the viewport. No top layer needed.
 */
export function createScopedContainer(scope: HTMLElement): CurtainsContainer {
    warning(
        typeof getComputedStyle !== "function" ||
            getComputedStyle(scope).position !== "static",
        "curtains: the `scope` element should be positioned (e.g. position: relative) so the overlay covers it"
    )

    const element = createOverlay({
        position: "absolute",
        inset: "0",
        overflow: "hidden",
        zIndex: "999999",
    })

    scope.appendChild(element)

    return {
        element,
        remove() {
            element.remove()
        },
    }
}
