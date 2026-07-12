// Each contributor gets a contained PANEL on the directory — a framed piece
// hung on the shelf's neutral wall, rendered in the visual language of one
// beautiful-html-templates design (baked into their skill as authorStyle).
// The wall provides unity; the frames provide personality.
//
// Card grammar, shared by every style: SUBJECT is the headline (what is
// actually being learned), description underneath, then a small meta line
// (doc title · template · updated).

import type { DocMeta } from "./store";
import { TOKENS_BY_ID, type StyleToken } from "./styleTokens";

export type AuthorGroup = {
  author: string;
  authorStyle: string;
  docs: DocMeta[];
};

export function AuthorPanel({ group }: { group: AuthorGroup }) {
  // A member who joined but hasn't published yet still gets their corner —
  // in their chosen palette, waiting for the first doc.
  if (group.docs.length === 0) {
    return <JustJoinedPanel group={group} />;
  }
  switch (group.authorStyle) {
    case "cobalt-grid":
      return <CobaltGridPanel group={group} />;
    case "block-frame":
      return <BlockFramePanel group={group} />;
    case "daisy-days":
      return <DaisyDaysPanel group={group} />;
    case "8-bit-orbit":
      return <EightBitOrbitPanel group={group} />;
    case "pin-and-paper":
      return <PinAndPaperPanel group={group} />;
    default: {
      const token = TOKENS_BY_ID[group.authorStyle];
      return token ? (
        <GenericPanel group={group} token={token} />
      ) : (
        <PlainPanel group={group} />
      );
    }
  }
}

const date = (iso: string) => iso.slice(0, 10);
// "~14 min" — measured by the server at publish time; hidden for old docs
// published before the field existed
const read = (doc: DocMeta) => (doc.readMinutes > 0 ? ` · ~${doc.readMinutes} min` : "");

// The empty corner of a member who has joined (via their kit's hello call)
// but hasn't pinned a first doc yet. Token-driven so it already wears their
// chosen design.
function JustJoinedPanel({ group }: { group: AuthorGroup }) {
  const token = TOKENS_BY_ID[group.authorStyle];
  const bg = token?.bg ?? "#FBF8EF";
  const ink = token?.ink ?? "#2D2A26";
  const accent = token?.accent ?? "#2D2A26";
  const display = token?.display ?? "'Zilla Slab', serif";
  const body = token?.body ?? "'Zilla Slab', serif";

  return (
    <section
      id={group.author.toLowerCase()}
      style={{
        background: bg,
        border: `2px solid ${ink}`,
        borderRadius: token?.radius,
        padding: "30px clamp(24px, 4vw, 44px) 36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", borderBottom: `2px solid ${ink}`, paddingBottom: "12px" }}>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: "clamp(28px, 3.6vw, 40px)", lineHeight: 1, color: ink }}>
          {group.author}
        </h2>
        <span style={{ fontFamily: body, fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
          just joined
        </span>
      </div>
      <p style={{ margin: "18px 0 0", fontFamily: body, fontSize: "16px", lineHeight: 1.6, color: ink, opacity: 0.85, maxWidth: "52ch" }}>
        this corner is claimed — {group.author} is picking a first topic.
      </p>
      <p style={{ margin: "10px 0 0", fontFamily: "'Caveat', cursive", fontWeight: 600, fontSize: "22px", color: accent }}>
        first doc coming soon ✎
      </p>
    </section>
  );
}

// A tiny progress meter for a doc's module journey. Rendered in the card's own
// ink + accent so it fits whatever style it lands in. Hidden when a doc has no
// module total set.
function ProgressBar({
  doc,
  ink,
  accent,
  font,
  onDark = false,
}: {
  doc: DocMeta;
  ink: string;
  accent: string;
  font: string;
  onDark?: boolean;
}) {
  if (!doc.modulesTotal || doc.modulesTotal <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round((doc.modulesDone / doc.modulesTotal) * 100)));
  const trackBg = onDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  return (
    // minWidth 0 at every level: the nowrap label must ellipsize instead of
    // widening the card's min-content past its grid track (content would
    // otherwise paint outside the card in every panel style)
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "5px", marginTop: "2px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", minWidth: 0, fontFamily: font, fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: ink, opacity: 0.85 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {doc.currentModule ? `on: ${doc.currentModule}` : "progress"}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{doc.modulesDone} / {doc.modulesTotal}</span>
      </div>
      <div style={{ height: "8px", border: `1.5px solid ${ink}`, background: trackBg, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COBALT GRID — cream paper, one strict cobalt accent, faint graph-paper,
// Newsreader serif + DM Mono, hairline ledger rows.
// ─────────────────────────────────────────────────────────────────────────
function CobaltGridPanel({ group }: { group: AuthorGroup }) {
  const paper = "#F0EBDE";
  const ink = "#1F2BE0";
  const serif = "'Newsreader', Georgia, serif";
  const sans = "'Hanken Grotesk', system-ui, sans-serif";
  const mono = "'DM Mono', ui-monospace, monospace";

  return (
    <section
      id={group.author.toLowerCase()}
      style={{
        background: paper,
        backgroundImage: `linear-gradient(${ink}14 1px, transparent 1px), linear-gradient(90deg, ${ink}14 1px, transparent 1px)`,
        backgroundSize: "30px 30px",
        border: `1.5px solid ${ink}`,
        padding: "34px clamp(24px, 4vw, 48px) 38px",
      }}
    >
      {/* the ledger row can't fit three columns on a phone — drop the meta
          under the title there (inline styles can't express media queries) */}
      <style>{`
        .cg-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; }
        .cg-meta { text-align: right; }
        @media (max-width: 560px) {
          .cg-row { grid-template-columns: 36px minmax(0, 1fr); }
          .cg-meta { grid-column: 2; text-align: left; padding-top: 0 !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "20px", borderBottom: `1.5px solid ${ink}`, paddingBottom: "10px" }}>
        <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontStyle: "italic", fontSize: "clamp(32px,4vw,46px)", lineHeight: 0.95, color: ink }}>
          {group.author}
        </h2>
        <span style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.1em", color: ink, textTransform: "uppercase" }}>
          index · {String(group.docs.length).padStart(2, "0")}
        </span>
      </div>

      {group.docs.map((doc, i) => (
        <a
          key={doc.slug}
          href={`/d/${doc.slug}`}
          className="cg-row"
          style={{
            gap: "18px",
            alignItems: "start",
            padding: "18px 0",
            borderBottom: i === group.docs.length - 1 ? "none" : `1px solid ${ink}2E`,
            textDecoration: "none",
            color: ink,
          }}
        >
          <span style={{ fontFamily: mono, fontSize: "12px", paddingTop: "8px" }}>{String(i + 1).padStart(2, "0")}</span>
          <span>
            <span style={{ display: "block", fontFamily: serif, fontWeight: 500, fontSize: "clamp(22px,2.4vw,30px)", lineHeight: 1.05 }}>{doc.subject}</span>
            {doc.description && (
              <span style={{ display: "block", marginTop: "6px", fontFamily: sans, fontSize: "14px", lineHeight: 1.5, color: "#3a3a3a", maxWidth: "58ch" }}>
                {doc.description}
              </span>
            )}
            <span style={{ display: "block", marginTop: "10px", maxWidth: "32ch" }}>
              <ProgressBar doc={doc} ink={ink} accent={ink} font={sans} />
            </span>
          </span>
          <span className="cg-meta" style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.04em", paddingTop: "8px", opacity: 0.85 }}>
            {doc.title}
            <br />
            {doc.template} · {date(doc.updatedAt)}{read(doc)}
          </span>
        </a>
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BLOCKFRAME — off-white, neon pastel blocks, heavy black borders, hard
// offset shadows, Space Grotesk heavy display + Inter body.
// ─────────────────────────────────────────────────────────────────────────
function BlockFramePanel({ group }: { group: AuthorGroup }) {
  const black = "#000000";
  const offwhite = "#FFFDF5";
  const fills = ["#FE90E8", "#C0F7FE", "#99E885", "#F7CB46"];
  const display = "'Space Grotesk', system-ui, sans-serif";
  const body = "'Inter', system-ui, sans-serif";

  return (
    <section
      id={group.author.toLowerCase()}
      style={{ background: offwhite, border: `4px solid ${black}`, boxShadow: `8px 8px 0 ${black}`, padding: "30px clamp(24px, 4vw, 44px) 36px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "24px" }}>
        <span style={{ display: "inline-block", background: fills[0], border: `3px solid ${black}`, boxShadow: `4px 4px 0 ${black}`, padding: "4px 12px", fontFamily: body, fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Contributor
        </span>
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "clamp(32px,4vw,48px)", lineHeight: 0.9, letterSpacing: "-0.02em", color: black, textTransform: "uppercase" }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "22px" }}>
        {group.docs.map((doc, i) => (
          <a
            key={doc.slug}
            href={`/d/${doc.slug}`}
            style={{ display: "flex", flexDirection: "column", background: "#fff", border: `3px solid ${black}`, boxShadow: `5px 5px 0 ${black}`, textDecoration: "none", color: black }}
          >
            <div style={{ height: "14px", background: fills[i % fills.length], borderBottom: `3px solid ${black}` }} />
            <div style={{ padding: "18px", display: "grid", gap: "10px", alignContent: "start" }}>
              <h3 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "24px", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{doc.subject}</h3>
              {doc.description && (
                <p style={{ margin: 0, fontFamily: body, fontSize: "13px", lineHeight: 1.55, color: "#222" }}>{doc.description}</p>
              )}
              <ProgressBar doc={doc} ink={black} accent={fills[i % fills.length]} font={body} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontFamily: body, fontWeight: 700, fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.07em", borderTop: `2px solid ${black}`, paddingTop: "9px" }}>
                <span>{doc.title}</span>
                <span style={{ opacity: 0.55, whiteSpace: "nowrap" }}>{date(doc.updatedAt)}{read(doc)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DAISY DAYS — cream, pastel rainbow, ink 3px outlines, chunky shadows,
// rounded corners, Fredoka display + Quicksand body, hand-drawn daisies.
// ─────────────────────────────────────────────────────────────────────────
function DaisyDaysPanel({ group }: { group: AuthorGroup }) {
  const cream = "#F5F0E6";
  const inkc = "#2D2D2D";
  const caps = ["#A8E6CF", "#D4A5E8", "#FFCBA4", "#A8D8F0", "#F7C8D4", "#FDE68A"];
  const display = "'Fredoka', system-ui, sans-serif";
  const body = "'Quicksand', system-ui, sans-serif";

  return (
    <section
      id={group.author.toLowerCase()}
      style={{ background: cream, border: `3px solid ${inkc}`, borderRadius: "22px", boxShadow: `6px 6px 0 ${inkc}`, padding: "30px clamp(24px, 4vw, 44px) 36px", position: "relative", overflow: "hidden" }}
    >
      <Daisy style={{ position: "absolute", top: "18px", right: "26px" }} color="#F7C8D4" ink={inkc} />

      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
        <Daisy color="#A8D8F0" ink={inkc} size={38} />
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 500, fontSize: "clamp(32px,4vw,46px)", lineHeight: 1, color: inkc }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "22px" }}>
        {group.docs.map((doc, i) => (
          <a key={doc.slug} href={`/d/${doc.slug}`} style={{ textDecoration: "none", color: inkc }}>
            <div style={{ background: caps[i % caps.length], border: `3px solid ${inkc}`, borderBottom: "none", borderRadius: "16px 16px 0 0", padding: "8px 16px", fontFamily: body, fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {doc.title}
            </div>
            <div style={{ background: "#fff", border: `3px solid ${inkc}`, borderRadius: "0 0 16px 16px", boxShadow: `5px 5px 0 ${inkc}`, padding: "16px", display: "grid", gap: "10px", alignContent: "start" }}>
              <h3 style={{ margin: 0, fontFamily: display, fontWeight: 500, fontSize: "23px", lineHeight: 1.02 }}>{doc.subject}</h3>
              {doc.description && (
                <p style={{ margin: 0, fontFamily: body, fontWeight: 500, fontSize: "13px", lineHeight: 1.55 }}>{doc.description}</p>
              )}
              <ProgressBar doc={doc} ink={inkc} accent={caps[i % caps.length]} font={body} />
              <span style={{ fontFamily: body, fontWeight: 700, fontSize: "11.5px", opacity: 0.6 }}>updated {date(doc.updatedAt)}{read(doc)}</span>
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
// 8-BIT ORBIT — deep navy void, neon cyan/pink/yellow, pixel L-brackets,
// Tektur display + Chakra Petch body + Space Mono captions, CRT energy.
// ─────────────────────────────────────────────────────────────────────────
function EightBitOrbitPanel({ group }: { group: AuthorGroup }) {
  const void_ = "#0A0E27";
  const navy = "#0F1B3D";
  const cyan = "#5EDCF4";
  const pink = "#F0A6CA";
  const yellow = "#F4D03F";
  const lav = "#E2D5F2";
  const display = "'Tektur', system-ui, sans-serif";
  const body = "'Chakra Petch', system-ui, sans-serif";
  const mono = "'Space Mono', ui-monospace, monospace";
  const accents = [cyan, pink, yellow];

  return (
    <section
      id={group.author.toLowerCase()}
      style={{
        background: void_,
        backgroundImage: `linear-gradient(${cyan}12 1px, transparent 1px), linear-gradient(90deg, ${cyan}12 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
        border: `2px solid ${cyan}`,
        boxShadow: `0 0 0 4px ${void_}, 6px 6px 0 ${pink}`,
        padding: "30px clamp(24px, 4vw, 44px) 36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "24px" }}>
        <span style={{ background: navy, color: yellow, fontFamily: mono, fontSize: "11px", letterSpacing: "0.1em", padding: "5px 12px", textTransform: "uppercase", border: `1px solid ${cyan}` }}>
          player
        </span>
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "clamp(30px,4vw,46px)", lineHeight: 1, color: cyan, textShadow: `2px 2px 0 ${pink}, 4px 4px 0 ${yellow}`, textTransform: "uppercase" }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "22px" }}>
        {group.docs.map((doc, i) => {
          const ac = accents[i % accents.length];
          return (
            <a
              key={doc.slug}
              href={`/d/${doc.slug}`}
              style={{ position: "relative", display: "block", background: "rgba(94,220,244,0.06)", border: `1.5px solid ${ac}`, padding: "18px", textDecoration: "none", color: lav }}
            >
              {/* pixel L-brackets at opposite corners */}
              <span aria-hidden style={{ position: "absolute", top: "-2px", left: "-2px", width: "14px", height: "14px", borderTop: `3px solid ${ac}`, borderLeft: `3px solid ${ac}` }} />
              <span aria-hidden style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "14px", height: "14px", borderBottom: `3px solid ${ac}`, borderRight: `3px solid ${ac}` }} />
              <h3 style={{ margin: 0, fontFamily: display, fontWeight: 700, fontSize: "23px", lineHeight: 1.05, color: ac, textTransform: "uppercase" }}>{doc.subject}</h3>
              {doc.description && <p style={{ margin: "10px 0 0", fontFamily: body, fontSize: "13px", lineHeight: 1.55, color: lav }}>{doc.description}</p>}
              <div style={{ marginTop: "12px" }}>
                <ProgressBar doc={doc} ink={ac} accent={ac} font={body} onDark />
              </div>
              <div style={{ marginTop: "12px", fontFamily: mono, fontSize: "10.5px", letterSpacing: "0.06em", color: yellow, textTransform: "uppercase", opacity: 0.85 }}>
                {doc.title} · {date(doc.updatedAt)}{read(doc)}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PIN & PAPER — saturated yellow paper, ink-blue Caveat handwriting, red
// accents, cards pinned slightly askew with hard ink-blue offset shadows.
// ─────────────────────────────────────────────────────────────────────────
function PinAndPaperPanel({ group }: { group: AuthorGroup }) {
  const paper = "#EFE56A";
  const cream = "#F8F1D6";
  const ink = "#1F3A8A";
  const red = "#C2342B";
  const script = "'Caveat', cursive";
  const body = "'Space Grotesk', system-ui, sans-serif";
  const mono = "'DM Mono', ui-monospace, monospace";
  const rotations = ["-1deg", "0.8deg", "-0.6deg", "1.2deg"];

  return (
    <section
      id={group.author.toLowerCase()}
      style={{
        background: paper,
        backgroundImage: "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 90% 90%, rgba(31,58,138,0.10), transparent 40%)",
        border: `1.5px solid ${ink}`,
        boxShadow: `5px 6px 0 ${ink}`,
        padding: "28px clamp(24px, 4vw, 44px) 36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "22px" }}>
        <SafetyPin ink={ink} />
        <h2 style={{ margin: 0, fontFamily: script, fontWeight: 700, fontSize: "clamp(38px,5vw,58px)", lineHeight: 0.9, color: ink }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "26px" }}>
        {group.docs.map((doc, i) => (
          <a
            key={doc.slug}
            href={`/d/${doc.slug}`}
            style={{
              display: "block",
              background: cream,
              border: `1.5px solid ${ink}`,
              borderRadius: "4px",
              boxShadow: `5px 6px 0 ${ink}`,
              padding: "18px",
              textDecoration: "none",
              color: ink,
              transform: `rotate(${rotations[i % rotations.length]})`,
            }}
          >
            <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "0.06em", color: red, textTransform: "uppercase", marginBottom: "8px" }}>
              {doc.title}
            </div>
            <h3 style={{ margin: 0, fontFamily: script, fontWeight: 700, fontSize: "30px", lineHeight: 0.95, color: ink }}>{doc.subject}</h3>
            {doc.description && <p style={{ margin: "8px 0 0", fontFamily: body, fontSize: "13px", lineHeight: 1.5, color: ink }}>{doc.description}</p>}
            <div style={{ marginTop: "12px" }}>
              <ProgressBar doc={doc} ink={ink} accent={red} font={body} />
            </div>
            <div style={{ marginTop: "12px", fontFamily: mono, fontSize: "10.5px", letterSpacing: "0.05em", color: ink, opacity: 0.6 }}>
              {date(doc.updatedAt)}{read(doc)}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function SafetyPin({ ink }: { ink: string }) {
  return (
    <svg aria-hidden width="46" height="20" viewBox="0 0 46 20" style={{ transform: "rotate(-8deg)" }}>
      <rect x="3" y="4" width="40" height="11" rx="5.5" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="8" cy="9.5" r="3.5" fill="none" stroke={ink} strokeWidth="2" />
      <line x1="8" y1="9.5" x2="40" y2="9.5" stroke={ink} strokeWidth="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GENERIC — any template offered in the picker but without a bespoke
// renderer gets a clean framed panel tinted by its real palette + display
// font. Not a full clone, but recognizably that template's register.
// ─────────────────────────────────────────────────────────────────────────
function GenericPanel({ group, token }: { group: AuthorGroup; token: StyleToken }) {
  const radius = token.radius ?? "0px";
  // choose a readable text color for the accent header strip
  const onAccent = isLight(token.accent) ? token.ink : "#ffffff";

  return (
    <section
      id={group.author.toLowerCase()}
      style={{
        background: token.bg,
        border: `2px solid ${token.ink}`,
        borderRadius: radius,
        boxShadow: `6px 6px 0 ${token.ink}`,
        padding: "28px clamp(24px, 4vw, 44px) 34px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "22px" }}>
        <span style={{ background: token.accent, color: onAccent, fontFamily: token.body, fontWeight: 700, fontSize: "11px", letterSpacing: "0.1em", padding: "5px 12px", textTransform: "uppercase", borderRadius: radius }}>
          {token.id}
        </span>
        <h2 style={{ margin: 0, fontFamily: token.display, fontWeight: 700, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1, color: token.ink }}>
          {group.author}
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "22px" }}>
        {group.docs.map((doc, i) => (
          <a
            key={doc.slug}
            href={`/d/${doc.slug}`}
            style={{ display: "flex", flexDirection: "column", background: "#ffffff", border: `2px solid ${token.ink}`, borderRadius: radius, boxShadow: `4px 4px 0 ${token.ink}`, textDecoration: "none", color: token.ink }}
          >
            <div style={{ height: "12px", background: i % 2 === 0 ? token.accent : token.accent2 ?? token.accent, borderBottom: `2px solid ${token.ink}`, borderRadius: radius === "0px" ? "0" : `${radius} ${radius} 0 0` }} />
            <div style={{ padding: "18px", display: "grid", gap: "10px", alignContent: "start" }}>
              <h3 style={{ margin: 0, fontFamily: token.display, fontWeight: 700, fontSize: "24px", lineHeight: 1.02 }}>{doc.subject}</h3>
              {doc.description && <p style={{ margin: 0, fontFamily: token.body, fontSize: "13px", lineHeight: 1.55 }}>{doc.description}</p>}
              <ProgressBar doc={doc} ink={token.ink} accent={token.accent} font={token.body} />
              <div style={{ fontFamily: token.body, fontWeight: 700, fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, borderTop: `1.5px solid ${token.ink}`, paddingTop: "9px" }}>
                {doc.title} · {date(doc.updatedAt)}{read(doc)}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function isLight(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return true;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// ─────────────────────────────────────────────────────────────────────────
// PLAIN — neutral fallback for authors whose style is unknown.
// ─────────────────────────────────────────────────────────────────────────
function PlainPanel({ group }: { group: AuthorGroup }) {
  const ink = "#2a2a2a";
  return (
    <section id={group.author.toLowerCase()} style={{ background: "#fff", border: `1.5px solid ${ink}`, padding: "30px clamp(24px,4vw,44px) 34px" }}>
      <h2 style={{ margin: "0 0 18px", fontFamily: "system-ui, sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.5vw,40px)", color: ink }}>{group.author}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: "16px" }}>
        {group.docs.map((doc) => (
          <a key={doc.slug} href={`/d/${doc.slug}`} style={{ border: `1.5px solid ${ink}`, padding: "16px", textDecoration: "none", color: ink, display: "grid", gap: "8px", alignContent: "start" }}>
            <strong style={{ fontSize: "19px" }}>{doc.subject}</strong>
            {doc.description && <span style={{ fontSize: "13px", lineHeight: 1.5, opacity: 0.8 }}>{doc.description}</span>}
            <ProgressBar doc={doc} ink={ink} accent={ink} font="system-ui, sans-serif" />
            <span style={{ fontSize: "11px", opacity: 0.6 }}>{doc.title} · {date(doc.updatedAt)}{read(doc)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
