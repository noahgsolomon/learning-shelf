"use client";

// The board's clickable ephemera: the polaroid and the depth stickies. Both
// open FLIP-animated modals — the element appears to lift off the paper from
// exactly where it was pinned and grow into the middle of the screen, then
// settle back on close. Handwritten bits use Permanent Marker (the sharpie).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DocMeta } from "@/lib/store";
import { DEPTH_LEVELS, depthIndex, projectedDepthIndex } from "@/lib/readtime";

const ink = "#2D2A26";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const sharpie = "'Permanent Marker', cursive";
const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";

const PIN_FILLS = [
  "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)",
  "radial-gradient(circle at 30% 30%, #4dabf7, #1864ab)",
  "radial-gradient(circle at 30% 30%, #69db7c, #2f9e44)",
  "radial-gradient(circle at 30% 30%, #ffd43b, #f59f00)",
];
const STICKY_FILLS = [
  "linear-gradient(135deg, #FFE066 0%, #FFD43B 100%)",
  "linear-gradient(135deg, #A5D8FF 0%, #74C0FC 100%)",
  "linear-gradient(135deg, #FFC9C9 0%, #FF9F9F 100%)",
  "#D0BFFF",
];

// ── The FLIP modal ────────────────────────────────────────────────────────
// Measure where the element sits on the paper, mount a fixed clone there,
// then let CSS transition it into the centered, enlarged state (and back).

type Origin = { left: number; top: number; width: number };

function useFlip() {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [entered, setEntered] = useState(false);

  function open(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setOrigin({ left: r.left, top: r.top, width: r.width });
  }
  function close() {
    setEntered(false);
    setTimeout(() => setOrigin(null), 340);
  }
  useEffect(() => {
    if (!origin) return;
    // a beat after mount so the clone paints at the origin before moving
    // (setTimeout, not rAF — background tabs throttle rAF indefinitely)
    const id = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(id);
  }, [origin]);

  return { origin, entered, open, close };
}

function FlipModal({
  origin,
  entered,
  targetWidth,
  onClose,
  children,
}: {
  origin: Origin;
  entered: boolean;
  targetWidth: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: entered ? "rgba(45,42,38,0.6)" : "rgba(45,42,38,0)",
        transition: "background 320ms ease",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: entered ? "50%" : `${origin.left}px`,
          top: entered ? "50%" : `${origin.top}px`,
          width: entered ? targetWidth : `${origin.width}px`,
          transform: entered ? "translate(-50%, -50%) rotate(0.6deg)" : "none",
          transition: "left 320ms cubic-bezier(.2,.8,.25,1), top 320ms cubic-bezier(.2,.8,.25,1), width 320ms cubic-bezier(.2,.8,.25,1), transform 320ms cubic-bezier(.2,.8,.25,1)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ── Polaroid ──────────────────────────────────────────────────────────────

export function Polaroid({ src, name, index }: { src: string; name: string; index: number }) {
  const { origin, entered, open, close } = useFlip();
  const lean = index % 2 === 0 ? "4deg" : "-3.5deg";

  return (
    <>
      <button
        onClick={(e) => open(e.currentTarget)}
        aria-label={`enlarge ${name}'s photo`}
        style={{
          position: "absolute",
          top: "-26px",
          right: "clamp(10px, 4vw, 42px)",
          transform: `rotate(${lean})`,
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
      </button>

      {origin && (
        <FlipModal origin={origin} entered={entered} targetWidth="min(78vw, 380px)" onClose={close}>
          <div
            style={{
              background: "#FDFDFB",
              padding: "4.5% 4.5% 0",
              boxShadow: "0 6px 16px rgba(20,16,12,0.45), 0 24px 60px rgba(20,16,12,0.4)",
              cursor: "zoom-out",
            }}
            onClick={close}
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
                fontSize: "clamp(24px, 6vw, 34px)",
                color: "#33302B",
                textAlign: "center",
                padding: "16px 0 20px",
                transform: "rotate(-1.6deg)",
              }}
            >
              {name.toLowerCase()}
            </div>
          </div>
        </FlipModal>
      )}
    </>
  );
}

// ── Depth stickies ────────────────────────────────────────────────────────

export function DepthStickies({ docs, index }: { docs: DocMeta[]; index: number }) {
  const dived = docs.filter((d) => d.wordCount > 0).slice(0, 3);
  const { origin, entered, open, close } = useFlip();
  const [active, setActive] = useState<DocMeta | null>(null);
  if (dived.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "-16px",
        left: "clamp(14px, 5vw, 52px)",
        right: "clamp(14px, 5vw, 52px)",
        display: "flex",
        justifyContent: "flex-start",
        gap: "14px",
        flexWrap: "wrap",
        zIndex: 6,
        pointerEvents: "none",
      }}
    >
      {dived.map((doc, d) => {
        const now = depthIndex(doc.wordCount);
        const headed = projectedDepthIndex(doc.wordCount, doc.modulesDone, doc.modulesTotal);
        return (
          <button
            key={doc.slug}
            title={`${doc.subject}: ${doc.wordCount.toLocaleString()} words written so far — click for the depth report`}
            onClick={(e) => {
              setActive(doc);
              open(e.currentTarget);
            }}
            style={{
              position: "relative",
              background: STICKY_FILLS[(index + d) % STICKY_FILLS.length],
              padding: "8px 14px 9px",
              border: "none",
              textAlign: "left",
              boxShadow: noteShadow,
              transform: `rotate(${(index + d) % 2 === 0 ? "-2deg" : "2.2deg"})`,
              pointerEvents: "auto",
              cursor: "zoom-in",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "-7px",
                left: "14px",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: PIN_FILLS[(index + d) % PIN_FILLS.length],
                boxShadow: "0 2px 4px rgba(45,42,38,0.45), inset -1px -1px 3px rgba(0,0,0,0.2)",
              }}
            />
            <span style={{ display: "block", lineHeight: 1, whiteSpace: "nowrap" }} aria-hidden>
              {DEPTH_LEVELS.map((l, i) => (
                <span key={l.label} style={{ fontSize: i === now ? "16px" : "11px", opacity: i <= now ? 1 : 0.3, filter: i <= now ? "none" : "grayscale(1)", marginRight: "2px" }}>
                  {l.emoji}
                </span>
              ))}
            </span>
            <span style={{ display: "block", marginTop: "3px", fontFamily: script, fontWeight: 700, fontSize: "16px", lineHeight: 1.1, color: ink, whiteSpace: "nowrap" }}>
              {dived.length > 1 ? `${doc.subject.toLowerCase()}: ` : ""}
              {DEPTH_LEVELS[now].label}
              {headed > now ? ` → ${DEPTH_LEVELS[headed].emoji} soon` : "!"}
            </span>
          </button>
        );
      })}

      {origin && active && (
        <FlipModal origin={origin} entered={entered} targetWidth="min(92vw, 440px)" onClose={() => { close(); setTimeout(() => setActive(null), 340); }}>
          <DepthReport doc={active} fill={STICKY_FILLS[(index + dived.indexOf(active)) % STICKY_FILLS.length]} pin={PIN_FILLS[(index + Math.max(0, dived.indexOf(active))) % PIN_FILLS.length]} />
        </FlipModal>
      )}
    </div>
  );
}

// The full dive report — everything the little sticky had no room for.
function DepthReport({ doc, fill, pin }: { doc: DocMeta; fill: string; pin: string }) {
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
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "-9px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: pin,
          boxShadow: "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)",
        }}
      />

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
