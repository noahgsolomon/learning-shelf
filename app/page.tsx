// The directory as a Scatterbrain cork board: the shelf's own chrome speaks
// post-it — Shrikhand display, Caveat handwriting, Zilla Slab body, sticky
// notes, thumbtacks, masking tape — and every contributor's panel hangs on
// the board as a pinned artifact with a small hand-placed rotation. Mixed
// panel styles stop being a clash and become the point: it's a pinboard.

import type { CSSProperties, ReactNode } from "react";
import { listDocs, type DocMeta } from "@/lib/store";
import { AuthorPanel, type AuthorGroup } from "@/lib/sections";

export const dynamic = "force-dynamic";

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";

const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";
const chipFills = ["#FFE066", "#A5D8FF", "#FFC9C9", "#B2F2BB", "#FFCC80", "#D0BFFF"];
const panelRotations = ["-0.7deg", "0.8deg", "-0.5deg", "0.6deg"];
const pinFills = [
  "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)",
  "radial-gradient(circle at 30% 30%, #4dabf7, #1864ab)",
  "radial-gradient(circle at 30% 30%, #69db7c, #2f9e44)",
  "radial-gradient(circle at 30% 30%, #ffd43b, #f59f00)",
];

export default async function ShelfPage() {
  const docs = await listDocs();
  const groups = groupByAuthor(docs);

  return (
    <main
      style={{
        minHeight: "100vh",
        color: ink,
        padding: "0 clamp(18px, 4vw, 48px)",
        overflowX: "hidden",
      }}
    >
      {/* corner doodles, scribbled on the board */}
      <Doodles />

      <div style={{ maxWidth: "1020px", margin: "0 auto", position: "relative" }}>
        <header style={{ padding: "60px 0 40px", position: "relative" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: display,
              fontWeight: 400,
              fontSize: "clamp(46px, 7vw, 78px)",
              lineHeight: 1,
              color: "#FBF7EE",
              textShadow: "3px 3px 0 rgba(45,42,38,0.45)",
              transform: "rotate(-1.2deg)",
            }}
          >
            The Shelf
          </h1>
          <p
            style={{
              margin: "6px 0 0 8px",
              fontFamily: script,
              fontWeight: 600,
              fontSize: "clamp(22px, 3vw, 30px)",
              color: "#3B2F21",
              transform: "rotate(-1deg)",
            }}
          >
            what we&apos;re learning lately ✎
          </p>

          {/* a short yellow sticky + the invite sticky, side by side */}
          <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", alignItems: "flex-start", marginTop: "26px" }}>
            <div
              style={{
                position: "relative",
                maxWidth: "400px",
                background: "linear-gradient(135deg, #FFE066 0%, #FFD43B 100%)",
                padding: "20px 24px 16px",
                boxShadow: noteShadow,
                transform: "rotate(-1.4deg)",
              }}
            >
              <Pin fill={pinFills[0]} />
              <p style={{ margin: 0, fontFamily: slab, fontSize: "17px", lineHeight: 1.5 }}>
                our little group of friends, pinning up whatever we&apos;re
                learning. our claudes keep the notes.
              </p>
            </div>
            <a
              href="/invite"
              style={{
                position: "relative",
                display: "inline-block",
                background: "linear-gradient(135deg, #FFC9C9 0%, #FFA8A8 100%)",
                padding: "18px 24px 16px",
                boxShadow: noteShadow,
                transform: "rotate(1.6deg)",
                textDecoration: "none",
                color: ink,
              }}
            >
              <Pin fill={pinFills[3]} />
              <span style={{ display: "block", fontFamily: display, fontSize: "20px", lineHeight: 1.1 }}>
                invite a friend
              </span>
              <span style={{ display: "block", marginTop: "4px", fontFamily: script, fontWeight: 600, fontSize: "18px" }}>
                mint them a starter kit ✂
              </span>
            </a>
          </div>

          {groups.length > 0 && (
            <nav style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center", marginTop: "30px" }}>
              <span style={{ fontFamily: script, fontWeight: 700, fontSize: "22px", color: "#3B2F21" }}>
                jump to a corner →
              </span>
              {groups.map((g, i) => (
                <a
                  key={g.author}
                  href={`#${g.author.toLowerCase()}`}
                  style={{
                    position: "relative",
                    fontFamily: slab,
                    fontWeight: 600,
                    fontSize: "15px",
                    color: ink,
                    textDecoration: "none",
                    background: chipFills[i % chipFills.length],
                    padding: "8px 16px 7px",
                    boxShadow: noteShadow,
                    transform: `rotate(${i % 2 === 0 ? "-2deg" : "2deg"})`,
                  }}
                >
                  {g.author.toLowerCase()} · {g.docs.length}
                </a>
              ))}
            </nav>
          )}
        </header>

        {groups.length === 0 ? (
          <div style={{ background: "#fff", border: `2px solid ${ink}`, padding: "24px", boxShadow: noteShadow, transform: "rotate(-1deg)", fontFamily: slab, fontSize: "17px", maxWidth: "480px" }}>
            Nothing pinned yet. Publish the first doc with the shelf skill.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "56px", paddingBottom: "24px" }}>
            {groups.map((group, i) => (
              <PinnedPage key={group.author} index={i} label={`${group.author.toLowerCase()}.html`}>
                <AuthorPanel group={group} />
              </PinnedPage>
            ))}
          </div>
        )}

        <footer
          style={{
            margin: "48px 0 0",
            padding: "8px 0 56px",
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
            fontFamily: script,
            fontWeight: 600,
            fontSize: "21px",
            color: "#3B2F21",
          }}
        >
          <span style={{ transform: "rotate(-0.8deg)" }}>
            want a corner? ask your claude — it has the shelf skill ✎
          </span>
          <span style={{ transform: "rotate(0.6deg)" }}>docs are living — they change as we learn ★</span>
        </footer>
      </div>
    </main>
  );
}

// A contributor panel presented as a PAGE STUCK TO THE BOARD: the styled panel
// is printed onto a cream paper sheet (a margin all around), the sheet lifts
// off the cork with a layered shadow, a peeled dog-ear sits at the corner, and
// masking tape + a thumbtack hold it up. This is the fusion — the corkboard
// contributes the paper/tape/pin; the contributor keeps their design inside.
function PinnedPage({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: ReactNode;
}) {
  const sheet = "#FBF8EF";
  return (
    <div
      style={{
        position: "relative",
        transform: `rotate(${panelRotations[index % panelRotations.length]})`,
      }}
    >
      {/* masking tape across the top */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-13px",
          left: "50%",
          transform: `translateX(-50%) rotate(${index % 2 === 0 ? "-2deg" : "2.5deg"})`,
          width: "120px",
          height: "30px",
          background:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.42) 0 6px, rgba(255,255,255,0.30) 6px 12px)",
          border: "1px solid rgba(255,255,255,0.32)",
          boxShadow: "0 1px 2px rgba(45,42,38,0.18)",
          zIndex: 5,
        }}
      />

      {/* the paper sheet: cream margin, a soft top highlight, and a layered
          shadow that reads as paper lifted off cork */}
      <div
        style={{
          position: "relative",
          background: `linear-gradient(180deg, #FFFDF7 0%, ${sheet} 22%)`,
          padding: "clamp(14px, 1.6vw, 22px)",
          boxShadow:
            "0 1px 1px rgba(45,42,38,0.18), 5px 10px 18px rgba(45,42,38,0.30), 14px 22px 34px rgba(45,42,38,0.18)",
          borderRadius: "2px",
        }}
      >
        {/* handwritten filename in the paper margin */}
        <div
          style={{
            position: "absolute",
            bottom: "clamp(3px, 0.5vw, 6px)",
            right: "clamp(16px, 2vw, 26px)",
            fontFamily: "'Caveat', cursive",
            fontWeight: 600,
            fontSize: "17px",
            color: "rgba(45,42,38,0.5)",
            zIndex: 2,
          }}
        >
          {label}
        </div>

        {children}

        {/* peeled dog-ear at the bottom-right corner */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "34px",
            height: "34px",
            background: `linear-gradient(135deg, transparent 0 50%, ${sheet} 50% 100%)`,
            boxShadow: "-3px -3px 6px rgba(45,42,38,0.22)",
            borderTop: "1px solid rgba(45,42,38,0.10)",
            borderLeft: "1px solid rgba(45,42,38,0.10)",
          }}
        />
      </div>

      {/* a tack pinning the sheet, color rotating per page */}
      <Pin
        fill={pinFills[index % pinFills.length]}
        style={{ left: "28px", top: "-9px", transform: "none", zIndex: 6 }}
      />
    </div>
  );
}

function Pin({ fill, style }: { fill: string; style?: CSSProperties }) {
  return (
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
        background: fill,
        boxShadow: "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)",
        zIndex: 4,
        ...style,
      }}
    />
  );
}

function Doodles() {
  const stroke = "rgba(45,42,38,0.35)";
  return (
    <svg
      aria-hidden
      width="220"
      height="160"
      viewBox="0 0 220 160"
      style={{ position: "absolute", top: "18px", right: "2vw", opacity: 0.5, pointerEvents: "none" }}
    >
      <path d="M20 60 C 50 20, 90 20, 120 55 S 190 90, 205 50" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 110 l 18 18 M48 110 l -18 18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="120" r="14" fill="none" stroke={stroke} strokeWidth="3" />
      <path d="M185 105 l 8 22 l 12 -18" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Group docs by author (case-insensitive). Each author's panel style is the
// authorStyle of their most recently updated doc; authors are ordered by that
// same recency, so the freshest contributor sits on top.
function groupByAuthor(docs: DocMeta[]): AuthorGroup[] {
  const map = new Map<string, DocMeta[]>();

  for (const doc of docs) {
    const key = doc.author.trim().toLowerCase();
    const bucket = map.get(key) ?? [];
    bucket.push(doc);
    map.set(key, bucket);
  }

  const groups: AuthorGroup[] = [...map.values()].map((bucket) => {
    const sorted = [...bucket].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return {
      author: sorted[0].author,
      authorStyle: sorted[0].authorStyle,
      docs: sorted,
    };
  });

  return groups.sort((a, b) =>
    b.docs[0].updatedAt.localeCompare(a.docs[0].updatedAt),
  );
}
