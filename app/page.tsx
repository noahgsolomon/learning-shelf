// The directory as a Scatterbrain cork board: the shelf's own chrome speaks
// post-it — Shrikhand display, Caveat handwriting, Zilla Slab body, sticky
// notes, thumbtacks, masking tape — and every contributor's panel hangs on
// the board as a pinned artifact with a small hand-placed rotation. Mixed
// panel styles stop being a clash and become the point: it's a pinboard.

import type { CSSProperties, ReactNode } from "react";
import { cookies } from "next/headers";
import { getAuthorRecord, listAvatarAuthors, listDocs, listJoinedAuthors, type DocMeta } from "@/lib/store";
import { OWNER_COOKIE } from "@/lib/owner";
import type { AuthorGroup } from "@/lib/sections";
import { TOKENS_BY_ID } from "@/lib/styleTokens";
import { LetsLearn } from "./LetsLearn";
import { OwnerControls } from "./OwnerControls";
import { InterestsTag, Polaroid } from "./BoardBits";
import { PagedPanel } from "./PagedPanel";
import { PixelCurtain } from "./PixelCurtain";

export const dynamic = "force-dynamic";

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";

const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";
const chipFills = ["#FFE066", "#A5D8FF", "#FFC9C9", "#B2F2BB", "#FFCC80", "#D0BFFF"];
const panelRotations = ["-0.7deg", "0.8deg", "-0.5deg", "0.6deg"];

// warm cream paper stock for the page mounts — deliberately not pure white
const SHEET = "#EBE2CC";
// fractal-noise paper grain, desaturated, as a tiny tiling SVG
const PAPER_GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='150' height='150' filter='url(#n)'/></svg>",
)}")`;
const pinFills = [
  "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)",
  "radial-gradient(circle at 30% 30%, #4dabf7, #1864ab)",
  "radial-gradient(circle at 30% 30%, #69db7c, #2f9e44)",
  "radial-gradient(circle at 30% 30%, #ffd43b, #f59f00)",
];

export default async function ShelfPage() {
  const [docs, avatarAuthors, joined] = await Promise.all([
    listDocs(),
    listAvatarAuthors(),
    listJoinedAuthors(),
  ]);
  // Whose browser is this? The owner cookie (set when their kit was minted)
  // unlocks the controls strip on that member's own paper.
  const cookieValue = (await cookies()).get(OWNER_COOKIE)?.value ?? "";
  const viewer = cookieValue.includes(".")
    ? cookieValue.slice(0, cookieValue.indexOf("."))
    : null;
  const groups = groupByAuthor(docs);
  // Per-author record data: claim date (polaroid chin) + the living
  // interests line (interests sticky).
  const joinedSince = new Map<string, string>();
  const interestsByAuthor = new Map<string, string>();
  await Promise.all(
    groups.map(async (g) => {
      const a = g.author.toLowerCase();
      const record = await getAuthorRecord(a);
      if (!record) return;
      if (record.createdAt) {
        joinedSince.set(
          a,
          new Date(record.createdAt)
            .toLocaleString("en-US", { month: "short", year: "numeric" })
            .toLowerCase(),
        );
      }
      if (record.interests) interestsByAuthor.set(a, record.interests);
    }),
  );
  // Members who announced themselves but haven't published yet get an empty
  // corner at the end of the board, already wearing their chosen design.
  for (const member of joined) {
    if (!groups.some((g) => g.author.toLowerCase() === member.author)) {
      groups.push({ author: member.author, authorStyle: member.style, docs: [] });
    }
  }

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
      {/* pixel wipe when entering someone's note */}
      <PixelCurtain />

      <div style={{ maxWidth: "1020px", margin: "0 auto", position: "relative" }}>
        <header style={{ padding: "60px 0 40px", position: "relative" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
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
              Learning Shelf
            </h1>
            <GithubStarSticky />
          </div>
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
                join the shelf
              </span>
              <span style={{ display: "block", marginTop: "4px", fontFamily: script, fontWeight: 600, fontSize: "18px" }}>
                got the password? grab your kit ✂
              </span>
            </a>
            {/* desktop only: opens Claude Code or Codex with the prompt typed */}
            <LetsLearn />
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

        {/* minmax(0,1fr): without it the implicit grid column auto-sizes to the
            panels' max-content width and overflows the sheet on narrow screens */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "56px", paddingBottom: "24px" }}>
          {groups.map((group, i) => (
            <PinnedPage
              key={group.author}
              index={i}
              author={group.author.toLowerCase()}
              tint={TOKENS_BY_ID[group.authorStyle]?.accent}
              interests={interestsByAuthor.get(group.author.toLowerCase())}
              avatar={
                avatarAuthors.has(group.author.toLowerCase())
                  ? {
                      src: `/a/${group.author.toLowerCase()}`,
                      name: group.author,
                      since: joinedSince.get(group.author.toLowerCase()),
                    }
                  : undefined
              }
            >
              <PagedPanel group={group} />
              {viewer === group.author.toLowerCase() && (
                <OwnerControls
                  author={group.author.toLowerCase()}
                  lessons={group.docs.map((d) => ({ slug: d.slug, subject: d.subject }))}
                />
              )}
            </PinnedPage>
          ))}
          {/* only when the board is genuinely empty — otherwise the header's
              invite sticky is the CTA and this would be redundant */}
          {groups.length === 0 && <EmptyCorner index={0} lonely />}
        </div>

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
            new here? tap “join the shelf” and grab your kit ✎
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
  avatar,
  tint,
  interests,
  author,
  children,
}: {
  index: number;
  avatar?: { src: string; name: string; since?: string };
  tint?: string;
  interests?: string;
  author?: string;
  children: ReactNode;
}) {
  return (
    <div
      // the author's dominant color — the pixel curtain reads this on click
      data-curtain-tint={tint}
      style={{
        position: "relative",
        transform: `rotate(${panelRotations[index % panelRotations.length]})`,
      }}
    >
      {/* the author's polaroid, overlapping the paper's top-right corner */}
      {avatar && <Polaroid src={avatar.src} name={avatar.name} since={avatar.since} index={index} />}
      {/* what they're into — a living line their agent rewrites per publish */}
      {interests && author && <InterestsTag author={author} interests={interests} index={index} />}
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

      {/* the paper sheet: warm cream margin (not white), a faint top highlight,
          a fractal-noise grain overlay, and a layered shadow that reads as
          paper lifted off the cork */}
      <div
        style={{
          position: "relative",
          background: `linear-gradient(180deg, #F3EAD3 0%, ${SHEET} 34%)`,
          padding: "clamp(15px, 1.7vw, 24px)",
          boxShadow:
            "0 1px 1px rgba(45,42,38,0.18), 5px 10px 18px rgba(45,42,38,0.30), 14px 22px 34px rgba(45,42,38,0.18)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        {children}

        {/* paper-grain overlay — sits above everything at low opacity so the
            whole page reads as printed on textured stock */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: PAPER_GRAIN,
            backgroundSize: "150px 150px",
            mixBlendMode: "multiply",
            opacity: 0.09,
            pointerEvents: "none",
            zIndex: 7,
          }}
        />
      </div>
    </div>
  );
}

// The board is never "done" — an empty page pinned at the end reads as a spot
// waiting for a friend, and is the whole board when nobody has published yet.
function EmptyCorner({ index, lonely }: { index: number; lonely: boolean }) {
  return (
    <div style={{ position: "relative", transform: `rotate(${index % 2 === 0 ? "0.8deg" : "-0.9deg"})` }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-13px",
          left: "50%",
          transform: "translateX(-50%) rotate(-2deg)",
          width: "116px",
          height: "30px",
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.42) 0 6px, rgba(255,255,255,0.30) 6px 12px)",
          border: "1px solid rgba(255,255,255,0.32)",
          zIndex: 5,
        }}
      />
      <div
        style={{
          border: "2px dashed rgba(45,42,38,0.5)",
          background: "rgba(251,248,239,0.35)",
          borderRadius: "3px",
          padding: "44px 28px",
          textAlign: "center",
          display: "grid",
          gap: "12px",
          placeItems: "center",
        }}
      >
        <p style={{ margin: 0, fontFamily: display, fontSize: "clamp(26px,3.4vw,38px)", lineHeight: 1, color: "#FBF7EE", textShadow: "2px 2px 0 rgba(45,42,38,0.4)" }}>
          {lonely ? "the board's empty" : "an empty spot"}
        </p>
        <p style={{ margin: 0, fontFamily: script, fontWeight: 600, fontSize: "22px", color: "#3B2F21", maxWidth: "34ch" }}>
          {lonely
            ? "be the first to claim a corner and pin what you're learning."
            : "room for another corner — grab a kit and claim it."}
        </p>
        <a
          href="/invite"
          style={{
            fontFamily: display,
            fontSize: "17px",
            color: ink,
            textDecoration: "none",
            background: "#FFC9C9",
            border: `2px solid ${ink}`,
            boxShadow: `3px 3px 0 ${ink}`,
            padding: "9px 20px",
            transform: "rotate(-1deg)",
          }}
        >
          join the shelf ✂
        </a>
      </div>
      <Pin fill="radial-gradient(circle at 30% 30%, #ffd43b, #f59f00)" style={{ left: "28px", top: "-9px", transform: "none", zIndex: 6 }} />
    </div>
  );
}

// A small GitHub-grey sticky tucked at the bottom-right corner of the title:
// the Octocat silhouette + a yellow star, linking to the (public) repo.
function GithubStarSticky() {
  return (
    <a
      href="https://github.com/noahgsolomon/learning-shelf"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Star Learning Shelf on GitHub"
      style={{
        position: "absolute",
        right: "-18px",
        bottom: "-14px",
        display: "flex",
        alignItems: "center",
        gap: "7px",
        background: "linear-gradient(135deg, #D6DADF 0%, #C2C8CE 100%)",
        padding: "6px 10px 5px",
        boxShadow: "1px 2px 6px rgba(45,42,38,0.3)",
        transform: "rotate(3deg)",
        textDecoration: "none",
        color: "#24292E",
        zIndex: 4,
      }}
    >
      <span aria-hidden style={{ position: "absolute", top: "-6px", left: "50%", transform: "translateX(-50%)", width: "11px", height: "11px", borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)", boxShadow: "0 1px 3px rgba(45,42,38,0.5), inset -1px -1px 2px rgba(0,0,0,0.25)" }} />
      <svg width="19" height="19" viewBox="0 0 16 16" fill="#24292E" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#F4D03F" aria-hidden>
        <path d="M12 2.5l2.7 5.7 6.2.8-4.5 4.3 1.1 6.1L12 16.6l-5.5 2.9 1.1-6.1L3.1 9l6.2-.8L12 2.5z" />
      </svg>
    </a>
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
