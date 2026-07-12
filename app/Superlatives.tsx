"use client";

// Board superlatives: a small orange sticky in the header cluster that
// morphs into a note of rotating hand-written awards. Celebratory, not
// competitive — different awards find different winners, and the collective
// line at the bottom is a "we", never a ranking. Computed server-side from
// data the board already has; nothing here is a score anyone can grind.

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

const ink = "#2D2A26";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const sharpie = "'Permanent Marker', cursive";
const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";
const MORPH = { type: "spring", bounce: 0.12, visualDuration: 0.18 } as const;

export type Award = { emoji: string; title: string; line: string };

export function Superlatives({
  awards,
  collective,
}: {
  awards: Award[];
  collective: string;
}) {
  const [open, setOpen] = useState(false);
  if (awards.length === 0) return null;

  return (
    <>
      <motion.button
        layoutId="superlatives"
        transition={MORPH}
        onClick={() => setOpen(true)}
        aria-label="board superlatives"
        style={{
          position: "relative",
          background: "#FFCC80",
          border: "none",
          padding: "16px 22px 15px",
          boxShadow: noteShadow,
          rotate: "1.2deg",
          fontFamily: script,
          fontWeight: 700,
          fontSize: "21px",
          lineHeight: 1.1,
          color: ink,
          cursor: "zoom-in",
          alignSelf: "flex-start",
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
            background: "radial-gradient(circle at 30% 30%, #d0bfff, #7048e8)",
            boxShadow: "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)",
          }}
        />
        superlatives 🏆
      </motion.button>

      <AnimatePresence>
        {open && (
          <Overlay onClose={() => setOpen(false)}>
              <motion.div
                layoutId="superlatives"
                transition={MORPH}
                onClick={() => setOpen(false)}
                style={{
                  width: "min(90vw, 430px)",
                  maxHeight: "88vh",
                  overflowY: "auto",
                  background: "#FFCC80",
                  padding: "26px 30px 28px",
                  boxShadow: "0 6px 16px rgba(20,16,12,0.45), 0 24px 60px rgba(20,16,12,0.4)",
                  rotate: "-0.8deg",
                  cursor: "zoom-out",
                  color: ink,
                }}
              >
                <div style={{ fontFamily: sharpie, fontSize: "24px", lineHeight: 1.1, transform: "rotate(-1.2deg)" }}>
                  board superlatives
                </div>
                <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                  {awards.map((a) => (
                    <div key={a.title} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "22px", lineHeight: 1.2 }}>{a.emoji}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: sharpie, fontSize: "14px", letterSpacing: "0.02em" }}>
                          {a.title}
                        </span>
                        <span style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "22px", lineHeight: 1.2 }}>
                          {a.line}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "20px",
                    paddingTop: "14px",
                    borderTop: `2px dashed rgba(45,42,38,0.3)`,
                    fontFamily: script,
                    fontWeight: 700,
                    fontSize: "21px",
                    lineHeight: 1.3,
                  }}
                >
                  {collective}
                </div>
                <div style={{ marginTop: "10px", fontFamily: slab, fontSize: "12.5px", opacity: 0.65 }}>
                  awards rotate as the board changes — nobody keeps a trophy for long
                </div>
              </motion.div>
          </Overlay>
        )}
      </AnimatePresence>
    </>
  );
}

// AnimatePresence drops raw portals (they aren't valid elements) — the
// portal must live INSIDE a component child. Same pattern as BoardBits.
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
