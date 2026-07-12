import { animate } from "motion/mini"
import { isHorizontal, originFor } from "../utils/directions"
import { resolveTransition } from "../utils/transition"
import { ELEMENT_CLASS } from "../class-names"
import { CurtainEffect, Direction } from "../types"

export interface DoorsOptions {
    /** Which axis the doors close along. Horizontal values → left/right
     *  doors; vertical values → top/bottom doors. Defaults to horizontal. */
    direction?: Direction
}

function createDoor(scale: string, place: Partial<CSSStyleDeclaration>) {
    const door = document.createElement("div")
    door.className = ELEMENT_CLASS
    Object.assign(door.style, {
        position: "absolute",
        willChange: "transform",
        transform: scale,
        ...place,
    })
    return door
}

/** Two panels that meet in the middle to cover, then part to reveal. */
export function doors(options: DoorsOptions = {}): CurtainEffect {
    const { direction = "left" } = options
    const horizontal = isHorizontal(direction)
    const scale = horizontal ? "scaleX" : "scaleY"
    const closed = `${scale}(0)`

    let panels: HTMLElement[]
    return {
        setup(container) {
            const first = horizontal
                ? createDoor(closed, {
                      top: "0",
                      left: "0",
                      width: "51%",
                      height: "100%",
                      transformOrigin: originFor("left"),
                  })
                : createDoor(closed, {
                      top: "0",
                      left: "0",
                      width: "100%",
                      height: "51%",
                      transformOrigin: originFor("up"),
                  })

            const second = horizontal
                ? createDoor(closed, {
                      top: "0",
                      left: "49%",
                      width: "51%",
                      height: "100%",
                      transformOrigin: originFor("right"),
                  })
                : createDoor(closed, {
                      top: "49%",
                      left: "0",
                      width: "100%",
                      height: "51%",
                      transformOrigin: originFor("down"),
                  })

            container.appendChild(first)
            container.appendChild(second)
            panels = [first, second]
        },
        cover(transition) {
            return animate(
                panels,
                { transform: [`${scale}(0)`, `${scale}(1)`] },
                resolveTransition(transition)
            )
        },
        reveal(transition) {
            return animate(
                panels,
                { transform: [`${scale}(1)`, `${scale}(0)`] },
                resolveTransition(transition)
            )
        },
    }
}
