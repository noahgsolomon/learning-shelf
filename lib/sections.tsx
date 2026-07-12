// Each author gets a full-width band on the directory, rendered in the visual
// language of one beautiful-html-templates design. The band a person receives
// is baked into their contributor skill (sent as `authorStyle` on publish), so
// every doc they add lands in their own aesthetic. The directory becomes a
// stacked zine: one spread per contributor.

import type { ReactNode } from "react";
import type { DocMeta } from "./store";

export type AuthorGroup = {
  author: string;
  authorStyle: string;
  docs: DocMeta[];
};

export function AuthorBand({ group }: { group: AuthorGroup }) {
  switch (group.authorStyle) {
    case "cobalt-grid":
      return <CobaltGridBand group={group} />;
    case "block-frame":
      return <BlockFrameBand group={group} />;
    case "daisy-days":
      return <DaisyDaysBand group={group} />;
    default:
      return <PlainBand group={group} />;
  }
}

const date = (iso: string) => iso.slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────
// COBALT GRID — cream paper, one strict cobalt accent, graph-paper canvas,
// Newsreader serif + DM Mono, pixel stair-blocks, hairline ledger rows.
// ─────────────────────────────────────────────────────────────────────────
function CobaltGridBand({ group }: { group: AuthorGroup }) {
  const paper = "#F0EBDE";
  const ink = "#1F2BE0";
  const serif = "'Newsreader', Georgia, serif";
  const sans = "'Hanken Grotesk', system-ui, sans-serif";
  const mono = "'DM Mono', ui-monospace, monospace";

  return (
    <section
      style={{
        background: paper,
        backgroundImage: `linear-gradient(${ink}1A 1px, transparent 1px), linear-gradient(90deg, ${ink}1A 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        padding: "48px clamp(28px, 6vw, 96px) 56px",
        position: "relative",
        overflow: "hidden",
        borderTop: `1.5px solid ${ink}`,
        borderBottom: `1.5px solid ${ink}`,
      }}
    >
      {/* pixel stair-block decoration, right edge */}
      <svg
        aria-hidden
        viewBox="0 0 120 200"
        style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "clamp(90px,14vw,180px)", opacity: 0.5 }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={i * 24} y={i * 22} width="22" height={200 - i * 22} fill="none" stroke={ink} strokeWidth="1.5">
            {[...Array(6)].map((_, j) => (
              <line key={j} x1={i * 24 + 3 + j * 3} y1={i * 22} x2={i * 24 + 3 + j * 3} y2="200" stroke={ink} strokeWidth="0.6" />
            ))}
          </rect>
        ))}
      </svg>

      <div style={{ position: "relative", zIndex: 2, maxWidth: "900px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "24px", borderBottom: `1.5px solid ${ink}`, paddingBottom: "12px" }}>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontStyle: "italic", fontSize: "clamp(40px,5.5vw,72px)", lineHeight: 0.95, color: ink }}>
            {group.author}
          </h2>
          <span style={{ fontFamily: mono, fontSize: "12px", letterSpacing: "0.1em", color: ink, textTransform: "uppercase" }}>
            Index · {String(group.docs.length).padStart(2, "0")}
          </span>
        </div>

        <div style={{ marginTop: "10px" }}>
          {group.docs.map((doc, i) => (
            <a
              key={doc.slug}
              href={`/d/${doc.slug}`}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr auto",
                gap: "20px",
                alignItems: "baseline",
                padding: "16px 0",
                borderBottom: `1px solid ${ink}2E`,
                textDecoration: "none",
                color: ink,
              }}
            >
              <span style={{ fontFamily: mono, fontSize: "13px" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(20px,2.4vw,30px)", lineHeight: 1.1 }}>{doc.title}</span>
              <span style={{ fontFamily: mono, fontSize: "11.5px", letterSpacing: "0.04em", textAlign: "right", whiteSpace: "nowrap" }}>
                {doc.template}
                <br />
                {date(doc.updatedAt)}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BLOCKFRAME — off-white, neon pastel blocks, heavy black borders, hard
// offset shadows, Space Grotesk heavy display + Inter body. Poster energy.
// ─────────────────────────────────────────────────────────────────────────
function BlockFrameBand({ group }: { group: AuthorGroup }) {
  const black = "#000000";
  const offwhite = "#FFFDF5";
  const fills = ["#FE90E8", "#C0F7FE", "#99E885", "#F7CB46"];
  const display = "'Space Grotesk', system-ui, sans-serif";
  const body = "'Inter', system-ui, sans-serif";

  return (
    <section style={{ background: offwhite, padding: "52px clamp(28px, 6vw, 96px) 60px", borderTop: `4px solid ${black}`, borderBottom: `4px solid ${black}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap", marginBottom: "30px" }}>
        <span style={{ display: "inline-block", background: fills[0], border: `3px solid ${black}`, boxShadow: `4px 4px 0 ${black}`, padding: "5px 14px", fontFamily: body, fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Contributor
        </span>
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "clamp(44px,6vw,80px)", lineHeight: 0.9, letterSpacing: "-0.02em", color: black, textTransform: "uppercase" }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "26px" }}>
        {group.docs.map((doc, i) => (
          <a
            key={doc.slug}
            href={`/d/${doc.slug}`}
            style={{ display: "flex", flexDirection: "column", background: "#fff", border: `4px solid ${black}`, boxShadow: `8px 8px 0 ${black}`, textDecoration: "none", color: black }}
          >
            <div style={{ height: "20px", background: fills[i % fills.length], borderBottom: `4px solid ${black}` }} />
            <div style={{ padding: "20px", display: "grid", gap: "14px" }}>
              <h3 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "26px", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{doc.title}</h3>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontFamily: body, fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", borderTop: `2px solid ${black}`, paddingTop: "10px" }}>
                <span>{doc.template}</span>
                <span style={{ opacity: 0.6 }}>{date(doc.updatedAt)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DAISY DAYS — cream, pastel rainbow, ink 3px outlines, chunky 6px shadows,
// rounded corners, Fredoka display + Quicksand body, hand-drawn daisies.
// ─────────────────────────────────────────────────────────────────────────
function DaisyDaysBand({ group }: { group: AuthorGroup }) {
  const cream = "#F5F0E6";
  const inkc = "#2D2D2D";
  const caps = ["#A8E6CF", "#D4A5E8", "#FFCBA4", "#A8D8F0", "#F7C8D4", "#FDE68A"];
  const display = "'Fredoka', system-ui, sans-serif";
  const body = "'Quicksand', system-ui, sans-serif";

  return (
    <section style={{ background: cream, padding: "50px clamp(28px, 6vw, 96px) 58px", borderTop: `3px solid ${inkc}`, borderBottom: `3px solid ${inkc}`, position: "relative", overflow: "hidden" }}>
      <Daisy style={{ position: "absolute", top: "24px", right: "40px" }} color="#F7C8D4" ink={inkc} />
      <Daisy style={{ position: "absolute", bottom: "26px", right: "120px" }} color="#FDE68A" ink={inkc} size={38} />

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px", position: "relative", zIndex: 2 }}>
        <Daisy color="#A8D8F0" ink={inkc} size={44} />
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 500, fontSize: "clamp(40px,5.5vw,72px)", lineHeight: 1, color: inkc }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px", position: "relative", zIndex: 2 }}>
        {group.docs.map((doc, i) => (
          <a key={doc.slug} href={`/d/${doc.slug}`} style={{ textDecoration: "none", color: inkc }}>
            <div style={{ background: caps[i % caps.length], border: `3px solid ${inkc}`, borderBottom: "none", borderRadius: "18px 18px 0 0", padding: "10px 18px", fontFamily: body, fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {doc.template}
            </div>
            <div style={{ background: "#fff", border: `3px solid ${inkc}`, borderRadius: "0 0 18px 18px", boxShadow: `6px 6px 0 ${inkc}`, padding: "18px", display: "grid", gap: "12px" }}>
              <h3 style={{ margin: 0, fontFamily: display, fontWeight: 500, fontSize: "24px", lineHeight: 1.02 }}>{doc.title}</h3>
              <span style={{ fontFamily: body, fontWeight: 600, fontSize: "12.5px", opacity: 0.65 }}>updated {date(doc.updatedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Daisy({ color, ink, size = 30, style }: { color: string; ink: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" style={style}>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse key={deg} cx="20" cy="9" rx="5.5" ry="9" fill={color} stroke={ink} strokeWidth="2" transform={`rotate(${deg} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="6" fill="#FDE68A" stroke={ink} strokeWidth="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PLAIN — neutral fallback for authors whose style is unknown.
// ─────────────────────────────────────────────────────────────────────────
function PlainBand({ group }: { group: AuthorGroup }) {
  const ink = "#3A2516";
  return (
    <section style={{ background: "#F1E6CB", padding: "44px clamp(28px, 6vw, 96px) 52px", borderTop: `1.5px solid ${ink}`, borderBottom: `1.5px solid ${ink}` }}>
      <h2 style={{ margin: "0 0 20px", fontFamily: "system-ui, sans-serif", fontWeight: 800, fontSize: "clamp(32px,4vw,52px)", color: ink }}>{group.author}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "18px" }}>
        {group.docs.map((doc) => (
          <a key={doc.slug} href={`/d/${doc.slug}`} style={{ border: `1.5px solid ${ink}`, padding: "16px", textDecoration: "none", color: ink, display: "grid", gap: "8px" }}>
            <strong style={{ fontSize: "20px" }}>{doc.title}</strong>
            <span style={{ fontSize: "12px", opacity: 0.7 }}>{doc.template} · {date(doc.updatedAt)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function GlobalHeader({ count }: { count: number }): ReactNode {
  const ink = "#111";
  return (
    <header style={{ background: "#fff", borderBottom: `3px solid ${ink}`, padding: "40px clamp(28px, 6vw, 96px) 30px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: "clamp(44px,7vw,88px)", lineHeight: 0.9, letterSpacing: "-0.03em", textTransform: "uppercase", color: ink }}>
            The Shelf
          </h1>
          <p style={{ margin: "12px 0 0", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "16px", maxWidth: "56ch", color: "#333" }}>
            A shared directory of living learning docs. Each contributor keeps a
            band below in their own template&apos;s aesthetic; each card is a
            single HTML file their Claude republishes as they learn.
          </p>
        </div>
        <span style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: "13px", letterSpacing: "0.06em", color: "#555", whiteSpace: "nowrap" }}>
          {count} doc{count === 1 ? "" : "s"}
        </span>
      </div>
    </header>
  );
}
