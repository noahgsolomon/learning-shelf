"use client";

// The invite desk: a sticky-note form on the cork board. Type a friend's
// name, pick their corner's design, and mint a paste-into-Claude installer
// that carries all three skills. Send it to them; they paste it into the
// Claude Code desktop app and their Claude sets everything up.

import { useState } from "react";

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";

const STYLES = [
  { id: "daisy-days", label: "daisy days · pastel daisies & rounded cards" },
  { id: "block-frame", label: "blockframe · neon blocks & heavy borders" },
  { id: "cobalt-grid", label: "cobalt grid · graph paper & electric serif" },
  { id: "plain", label: "plain · keep it simple for now" },
];

export default function InvitePage() {
  const [name, setName] = useState("");
  const [style, setStyle] = useState("daisy-days");
  const [installer, setInstaller] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function mint() {
    if (!name.trim()) return;
    setBusy(true);
    setCopied(false);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, style }),
    });
    const data = await res.json();
    setInstaller(data.installer ?? null);
    setBusy(false);
  }

  async function copy() {
    if (!installer) return;
    await navigator.clipboard.writeText(installer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    if (!installer) return;
    const blob = new Blob([installer], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shelf-invite-${name.trim().toLowerCase().split(/\s+/)[0] || "friend"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main style={{ minHeight: "100vh", color: ink, padding: "0 clamp(18px, 4vw, 48px)" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "56px 0 72px" }}>
        <a href="/" style={{ fontFamily: script, fontWeight: 700, fontSize: "22px", color: "#3B2F21", textDecoration: "none" }}>
          ← back to the board
        </a>

        <h1
          style={{
            margin: "18px 0 0",
            fontFamily: display,
            fontWeight: 400,
            fontSize: "clamp(38px, 6vw, 58px)",
            lineHeight: 1,
            color: "#FBF7EE",
            textShadow: "3px 3px 0 rgba(45,42,38,0.45)",
            transform: "rotate(-1deg)",
          }}
        >
          invite a friend
        </h1>

        {/* the form, on a green sticky */}
        <div
          style={{
            position: "relative",
            marginTop: "30px",
            background: "linear-gradient(135deg, #B2F2BB 0%, #8CE99A 100%)",
            padding: "26px 28px 24px",
            boxShadow: noteShadow,
            transform: "rotate(-0.8deg)",
          }}
        >
          <span aria-hidden style={{ position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)", width: "16px", height: "16px", borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)", boxShadow: "0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2)" }} />
          <label style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "24px", marginBottom: "8px" }}>
            who&apos;s joining?
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mint()}
            placeholder="their first name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: slab,
              fontSize: "18px",
              padding: "10px 14px",
              border: `2px solid ${ink}`,
              background: "#FFFDF5",
              color: ink,
              outline: "none",
            }}
          />
          <label style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "24px", margin: "18px 0 8px" }}>
            their corner&apos;s design?
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            style={{
              width: "100%",
              fontFamily: slab,
              fontSize: "16px",
              padding: "10px 12px",
              border: `2px solid ${ink}`,
              background: "#FFFDF5",
              color: ink,
            }}
          >
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={mint}
            disabled={busy || !name.trim()}
            style={{
              marginTop: "20px",
              fontFamily: display,
              fontSize: "18px",
              padding: "10px 22px",
              background: "#FFE066",
              color: ink,
              border: `2px solid ${ink}`,
              boxShadow: "3px 3px 0 rgba(45,42,38,0.5)",
              cursor: busy || !name.trim() ? "not-allowed" : "pointer",
              opacity: busy || !name.trim() ? 0.6 : 1,
              transform: "rotate(0.5deg)",
            }}
          >
            {busy ? "minting…" : "mint the invite ✂"}
          </button>
        </div>

        {installer && (
          <div
            style={{
              position: "relative",
              marginTop: "36px",
              background: "#FFFDF5",
              border: `2px solid ${ink}`,
              padding: "24px 26px",
              boxShadow: noteShadow,
              transform: "rotate(0.5deg)",
            }}
          >
            <p style={{ margin: 0, fontFamily: script, fontWeight: 700, fontSize: "24px" }}>
              done! send this to {name.trim().split(/\s+/)[0]} ✉
            </p>
            <p style={{ margin: "8px 0 14px", fontFamily: slab, fontSize: "15.5px", lineHeight: 1.55 }}>
              They paste the whole thing into their Claude Code app. Their
              Claude installs the three skills (the shelf, how we like to
              learn, and the template library), then helps them start their
              first doc.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
              <button onClick={copy} style={btnStyle("#A5D8FF")}>{copied ? "copied ✓" : "copy it"}</button>
              <button onClick={download} style={btnStyle("#FFC9C9")}>download .md</button>
            </div>
            <textarea
              readOnly
              value={installer}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "260px",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11.5px",
                lineHeight: 1.5,
                padding: "12px",
                border: `1.5px solid ${ink}`,
                background: "#F7F5F0",
                color: ink,
                resize: "vertical",
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    fontFamily: slab,
    fontWeight: 600,
    fontSize: "15px",
    padding: "8px 18px",
    background: bg,
    color: ink,
    border: `2px solid ${ink}`,
    boxShadow: "2px 2px 0 rgba(45,42,38,0.5)",
    cursor: "pointer",
  };
}
