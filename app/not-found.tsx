// The corkboard 404: a note that fell off the board. Same Scatterbrain
// language as the directory so a bad link still feels like our site.

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        color: ink,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: display,
            fontWeight: 400,
            fontSize: "clamp(56px, 12vw, 110px)",
            lineHeight: 1,
            color: "#FBF7EE",
            textShadow: "4px 4px 0 rgba(45,42,38,0.45)",
            transform: "rotate(-1.5deg)",
          }}
        >
          404
        </h1>

        {/* the fallen note */}
        <div
          style={{
            position: "relative",
            display: "inline-block",
            margin: "34px auto 0",
            maxWidth: "340px",
            background: "linear-gradient(180deg, #FFE066 0%, #FFD43B 100%)",
            padding: "26px 30px 30px",
            boxShadow: "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)",
            transform: "rotate(1.6deg)",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "-8px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)",
              boxShadow: "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)",
            }}
          />
          <p style={{ margin: 0, fontFamily: script, fontWeight: 700, fontSize: "28px", lineHeight: 1.15 }}>
            this note fell off the board
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: slab, fontSize: "16px", lineHeight: 1.5 }}>
            whatever was pinned here is gone — maybe the link is old, maybe it
            never existed.
          </p>
        </div>

        <div style={{ marginTop: "30px" }}>
          <a
            href="/"
            style={{
              fontFamily: script,
              fontWeight: 700,
              fontSize: "24px",
              color: "#3B2F21",
              textDecoration: "none",
            }}
          >
            ← back to the board
          </a>
        </div>
      </div>
    </main>
  );
}
