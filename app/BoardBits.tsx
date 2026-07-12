"use client";

// The board's clickable ephemera: the polaroid and the depth tags. Both open
// modals via Motion's shared-element (layoutId) transition — the element
// morphs from where it sits on the paper into the centered enlargement and
// morphs back on close. Handwritten bits use Permanent Marker (the sharpie).

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { DocMeta } from "@/lib/store";
import { DEPTH_LEVELS, depthIndex, projectedDepthIndex } from "@/lib/readtime";

const ink = "#2D2A26";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const sharpie = "'Permanent Marker', cursive";

const STICKY_FILLS = [
  "linear-gradient(135deg, #FFE066 0%, #FFD43B 100%)",
  "linear-gradient(135deg, #A5D8FF 0%, #74C0FC 100%)",
  "linear-gradient(135deg, #FFC9C9 0%, #FF9F9F 100%)",
  "#D0BFFF",
];

const MORPH = { type: "spring", bounce: 0.12, visualDuration: 0.18 } as const;

// Full-screen dimmed backdrop that fades while the shared element morphs.
function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(45,42,38,0.6)",
        display: "grid",
        placeItems: "center",
        padding: "20px",
        zIndex: 60,
      }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

// ── Polaroid ──────────────────────────────────────────────────────────────

export function Polaroid({ src, name, since, index }: { src: string; name: string; since?: string; index: number }) {
  const [open, setOpen] = useState(false);
  const lean = index % 2 === 0 ? "4deg" : "-3.5deg";
  const id = `polaroid-${name.toLowerCase()}`;

  return (
    <>
      <motion.button
        layoutId={id}
        transition={MORPH}
        onClick={() => setOpen(true)}
        aria-label={`enlarge ${name}'s photo`}
        style={{
          position: "absolute",
          top: "-26px",
          right: "clamp(10px, 4vw, 42px)",
          rotate: lean,
          background: "#FDFDFB",
          padding: "7px 7px 24px",
          border: "none",
          boxShadow: "0 2px 4px rgba(45,42,38,0.28), 4px 8px 18px rgba(45,42,38,0.32)",
          zIndex: 6,
          cursor: "zoom-in",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded
            blob with no known dimensions; next/image needs both */}
        <img
          src={src}
          alt=""
          width={86}
          height={86}
          style={{ display: "block", width: "86px", height: "86px", objectFit: "cover", filter: "saturate(0.92) contrast(1.02)" }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <Backdrop onClose={() => setOpen(false)}>
            <motion.div
              layoutId={id}
              transition={MORPH}
              onClick={() => setOpen(false)}
              style={{
                // also clamped by viewport height (square photo + chin), so
                // the card always fits — no scrolling a polaroid
                width: "min(78vw, 380px, calc(88vh - 150px))",
                background: "#FDFDFB",
                padding: "16px 16px 0",
                boxShadow: "0 6px 16px rgba(20,16,12,0.45), 0 24px 60px rgba(20,16,12,0.4)",
                rotate: "0.6deg",
                cursor: "zoom-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={name}
                style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", filter: "saturate(0.92) contrast(1.02)" }}
              />
              {/* the sharpie chin */}
              <div
                style={{
                  fontFamily: sharpie,
                  color: "#33302B",
                  textAlign: "center",
                  padding: "14px 0 18px",
                  transform: "rotate(-1.6deg)",
                }}
              >
                <div style={{ fontSize: "clamp(24px, 6vw, 34px)", lineHeight: 1.05 }}>{name.toLowerCase()}</div>
                {since && (
                  <div style={{ fontSize: "clamp(13px, 3vw, 16px)", opacity: 0.6, marginTop: "2px" }}>
                    on the shelf since {since}
                  </div>
                )}
              </div>
            </motion.div>
          </Backdrop>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Depth tag ─────────────────────────────────────────────────────────────
// A tiny sticky stuck next to the doc's title — just the current level's
// emoji + name. Board language (post-it fill, hand lean, Caveat) on top of
// the author's card; a click morphs it into the full depth report. The cards
// are links, so the tag swallows the click instead of navigating.

export function DepthTag({ doc, tilt = 0 }: { doc: DocMeta; tilt?: number }) {
  const [open, setOpen] = useState(false);
  if (doc.wordCount <= 0) return null;
  const now = depthIndex(doc.wordCount);
  const fill = STICKY_FILLS[tilt % STICKY_FILLS.length];
  const id = `depth-${doc.slug}`;

  return (
    <>
      <motion.span
        layoutId={id}
        transition={MORPH}
        role="button"
        tabIndex={0}
        title={`${doc.wordCount.toLocaleString()} words written so far — click for the depth report`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: fill,
          padding: "3px 9px 4px",
          boxShadow: "1px 2px 6px rgba(45,42,38,0.3)",
          rotate: tilt % 2 === 0 ? "-2deg" : "2deg",
          fontFamily: script,
          fontWeight: 700,
          fontSize: "14px",
          lineHeight: 1,
          color: ink,
          whiteSpace: "nowrap",
          cursor: "zoom-in",
          verticalAlign: "middle",
        }}
      >
        <span aria-hidden style={{ fontSize: "13px" }}>{DEPTH_LEVELS[now].emoji}</span>
        {DEPTH_LEVELS[now].label}
      </motion.span>

      <AnimatePresence>
        {open && (
          <Backdrop onClose={() => setOpen(false)}>
            <motion.div
              layoutId={id}
              transition={MORPH}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(92vw, 440px)",
                maxHeight: "88vh",
                overflowY: "auto",
                rotate: "0.6deg",
              }}
            >
              <DepthReport doc={doc} fill={fill} />
            </motion.div>
          </Backdrop>
        )}
      </AnimatePresence>
    </>
  );
}

// The full dive report — everything the little sticky had no room for.
function DepthReport({ doc, fill }: { doc: DocMeta; fill: string }) {
  const now = depthIndex(doc.wordCount);
  const headed = projectedDepthIndex(doc.wordCount, doc.modulesDone, doc.modulesTotal);
  const next = now < DEPTH_LEVELS.length - 1 ? DEPTH_LEVELS[now + 1] : null;
  const wordsToNext = next ? next.minWords - doc.wordCount : 0;
  const hasModules = doc.modulesTotal > 0 && doc.modulesDone > 0;
  const projectedWords = hasModules && doc.modulesDone < doc.modulesTotal
    ? Math.round(doc.wordCount * (doc.modulesTotal / doc.modulesDone))
    : doc.wordCount;

  return (
    <div
      style={{
        position: "relative",
        background: fill,
        padding: "26px 28px 28px",
        boxShadow: "0 6px 16px rgba(20,16,12,0.45), 0 24px 60px rgba(20,16,12,0.4)",
        color: ink,
      }}
    >
      <div style={{ fontFamily: sharpie, fontSize: "24px", lineHeight: 1.1, transform: "rotate(-1.2deg)" }}>
        depth report
      </div>
      <div style={{ fontFamily: script, fontWeight: 700, fontSize: "21px", marginTop: "2px", opacity: 0.85 }}>
        {doc.subject.toLowerCase()}
      </div>

      {/* the ladder — every zone, with "you are here" scrawled at the level */}
      <div style={{ display: "grid", gap: "6px", margin: "18px 0 0" }}>
        {DEPTH_LEVELS.map((l, i) => {
          const reached = i <= now;
          const current = i === now;
          return (
            <div
              key={l.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 10px",
                background: current ? "rgba(255,255,255,0.55)" : "transparent",
                border: current ? `2px solid ${ink}` : "2px solid transparent",
                opacity: reached ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: "19px", filter: reached ? "none" : "grayscale(1)" }}>{l.emoji}</span>
              <span style={{ fontFamily: slab, fontWeight: 600, fontSize: "14.5px", flex: 1 }}>{l.label}</span>
              <span style={{ fontFamily: slab, fontSize: "12px", opacity: 0.7 }}>
                {l.minWords === 0 ? "first words" : `${l.minWords.toLocaleString()}+ words`}
              </span>
              {current && (
                <span style={{ fontFamily: sharpie, fontSize: "13px", transform: "rotate(-2deg)", whiteSpace: "nowrap" }}>
                  ← here
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* the numbers */}
      <div style={{ display: "flex", gap: "10px 22px", flexWrap: "wrap", marginTop: "16px", fontFamily: slab, fontSize: "14px", lineHeight: 1.5 }}>
        <span><strong>{doc.wordCount.toLocaleString()}</strong> words written</span>
        {doc.readMinutes > 0 && <span><strong>~{doc.readMinutes} min</strong> read</span>}
        {doc.modulesTotal > 0 && (
          <span><strong>{doc.modulesDone} / {doc.modulesTotal}</strong> modules{doc.currentModule ? ` — on: ${doc.currentModule}` : ""}</span>
        )}
      </div>

      {/* the forecast, scrawled */}
      <div style={{ marginTop: "14px", fontFamily: script, fontWeight: 700, fontSize: "19px", lineHeight: 1.3 }}>
        {headed > now ? (
          <>at this pace the finished dive lands in {DEPTH_LEVELS[headed].label} {DEPTH_LEVELS[headed].emoji} — roughly {projectedWords.toLocaleString()} words</>
        ) : next ? (
          <>{wordsToNext.toLocaleString()} more words and they hit {next.label} {next.emoji}</>
        ) : (
          <>the abyss. there is no deeper. 🦑</>
        )}
      </div>
      {headed > now && next && (
        <div style={{ marginTop: "4px", fontFamily: script, fontWeight: 600, fontSize: "16px", opacity: 0.75 }}>
          ({wordsToNext.toLocaleString()} words to {next.label} {next.emoji})
        </div>
      )}
    </div>
  );
}
