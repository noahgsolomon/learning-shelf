import type { CSSProperties, ReactNode } from "react";

// A realistic sticky note: an organic hand-cut edge via an SVG clip-path, and
// a layered lift shadow behind so the note peels off the cork. Render
// <StickyClipDef/> once per page (it's in the root layout) so the clip id
// resolves. Adapted from the classic clip-path sticky technique.

export function StickyClipDef() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <clipPath id="stickyClip" clipPathUnits="objectBoundingBox">
          <path d="M 0 0 Q 0 0.69, 0.03 0.96 0.03 0.96, 1 0.96 Q 0.96 0.69, 0.96 0 0.96 0, 0 0" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function Sticky({
  background,
  rotate = "0deg",
  padding = "22px 26px 26px",
  pinFill,
  href,
  external = false,
  children,
  wrapStyle,
}: {
  background: string;
  rotate?: string;
  padding?: string;
  pinFill?: string;
  href?: string;
  external?: boolean;
  children: ReactNode;
  wrapStyle?: CSSProperties;
}) {
  const body = (
    <div
      style={{
        position: "relative",
        transform: `rotate(${rotate})`,
        display: "inline-block",
        ...wrapStyle,
      }}
    >
      {/* lift shadow: an offset dark block behind the lower portion of the
          note, so the paper reads as peeling up off the surface */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "5px",
          top: "28%",
          width: "91%",
          height: "72%",
          background: "rgba(0,0,0,0.20)",
          boxShadow: "-2px 3px 16px 1px rgba(0,0,0,0.42)",
          zIndex: 0,
        }}
      />
      {/* the note itself, clipped to the organic edge */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background,
          clipPath: "url(#stickyClip)",
          padding,
        }}
      >
        {children}
      </div>
      {/* the tack sits on the wrapper, outside the clip so it isn't cut off */}
      {pinFill && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "-8px",
            left: "26px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: pinFill,
            boxShadow:
              "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)",
            zIndex: 3,
          }}
        />
      )}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{ textDecoration: "none", color: "inherit", display: "inline-block" }}
      >
        {body}
      </a>
    );
  }
  return body;
}
