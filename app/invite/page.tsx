"use client";

// The join desk: a newcomer (who a friend gave the password to) lands here,
// enters their own name + the password + picks a corner design, and gets a
// paste-into-Claude installer carrying all three skills. They paste it into
// the Claude Code desktop app and their Claude sets everything up.

import { useState } from "react";
import { STYLE_TOKENS } from "@/lib/styleTokens";
import { Sticky } from "@/lib/Sticky";

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";

export default function InvitePage() {
  const [name, setName] = useState("");
  const [style, setStyle] = useState(STYLE_TOKENS[0].id);
  const [password, setPassword] = useState("");
  const [installer, setInstaller] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    if (!name.trim() || !password.trim()) return;
    setBusy(true);
    setCopied(false);
    setError(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, style, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "something went wrong");
      setInstaller(null);
    } else {
      setInstaller(data.installer ?? null);
    }
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
    a.download = `shelf-kit-${name.trim().toLowerCase().split(/\s+/)[0] || "friend"}.md`;
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
          claim your corner
        </h1>

        {/* the form, on a green sticky */}
        <Sticky
          background="linear-gradient(135deg, #B2F2BB 0%, #8CE99A 100%)"
          rotate="-0.8deg"
          pinFill="radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a)"
          padding="28px 30px 34px"
          wrapStyle={{ marginTop: "30px", display: "block", width: "100%" }}
        >
          <label style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "24px", marginBottom: "8px" }}>
            what&apos;s your name?
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mint()}
            placeholder="your first name"
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
            the shelf password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mint()}
            placeholder="the one a friend gave you"
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
          <label style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "24px", margin: "18px 0 10px" }}>
            your corner&apos;s design? — tap one
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "12px",
              maxHeight: "360px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {STYLE_TOKENS.map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  title={s.label}
                  style={{
                    display: "block",
                    padding: 0,
                    background: "#FFFDF5",
                    border: active ? `3px solid ${ink}` : `2px solid rgba(45,42,38,0.35)`,
                    boxShadow: active ? `3px 3px 0 ${ink}` : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.preview}
                    alt={s.label}
                    loading="lazy"
                    style={{ display: "block", width: "100%", height: "90px", objectFit: "cover", borderBottom: `2px solid ${ink}` }}
                  />
                  <span style={{ display: "block", padding: "7px 9px", fontFamily: slab, fontWeight: active ? 700 : 500, fontSize: "12px", lineHeight: 1.25, color: ink }}>
                    {s.label.split(" — ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={mint}
            disabled={busy || !name.trim() || !password.trim()}
            style={{
              marginTop: "20px",
              fontFamily: display,
              fontSize: "18px",
              padding: "10px 22px",
              background: "#FFE066",
              color: ink,
              border: `2px solid ${ink}`,
              boxShadow: "3px 3px 0 rgba(45,42,38,0.5)",
              cursor: busy || !name.trim() || !password.trim() ? "not-allowed" : "pointer",
              opacity: busy || !name.trim() || !password.trim() ? 0.6 : 1,
              transform: "rotate(0.5deg)",
            }}
          >
            {busy ? "making your kit…" : "make my kit ✂"}
          </button>
          {error && (
            <p style={{ margin: "14px 0 0", fontFamily: slab, fontWeight: 600, fontSize: "15px", color: "#C2342B" }}>
              {error}
            </p>
          )}
        </Sticky>

        {installer && (
          <Sticky
            background="linear-gradient(180deg, #FFFEF8 0%, #FDF6E0 100%)"
            rotate="0.5deg"
            pinFill="radial-gradient(circle at 30% 30%, #69db7c, #2f9e44)"
            padding="26px 28px 34px"
            wrapStyle={{ marginTop: "36px", display: "block", width: "100%" }}
          >
            <p style={{ margin: 0, fontFamily: script, fontWeight: 700, fontSize: "24px" }}>
              done, {name.trim().split(/\s+/)[0]}! here&apos;s your kit ✉
            </p>
            <p style={{ margin: "8px 0 14px", fontFamily: slab, fontSize: "15.5px", lineHeight: 1.55 }}>
              Paste the whole thing into your Claude Code desktop app. Your
              Claude installs the three skills (the shelf, how we like to learn,
              and the template library), then helps you start your first doc.
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
          </Sticky>
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
