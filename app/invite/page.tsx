"use client";

// The join desk: a newcomer (who a friend gave the password to) lands here,
// enters their own name + the password + picks a corner design, and gets a
// paste-into-your-agent installer carrying all three skills. They paste it
// into Claude Code or Codex and the agent sets everything up for both tools.

import { useState } from "react";
import { STYLE_TOKENS } from "@/lib/styleTokens";

const ink = "#2D2A26";
const display = "'Shrikhand', cursive";
const script = "'Caveat', cursive";
const slab = "'Zilla Slab', serif";
const noteShadow = "2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28)";

export default function InvitePage() {
  const [name, setName] = useState("");
  const [style, setStyle] = useState(STYLE_TOKENS[0].id);
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  // Take any image the user hands us — file picker or drag-and-drop — and
  // make it uploadable: big phone photos (Apple shots are routinely >2MB)
  // get downscaled on a canvas so they sail under the host's ~4.5MB request
  // cap. Renders at 86px on the board, so 1200px is already generous.
  async function acceptPhoto(f: File | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("that doesn't look like an image");
      return;
    }
    if (f.size <= 3.5 * 1024 * 1024) {
      setPhoto(f);
      return;
    }
    try {
      const bitmap = await createImageBitmap(f);
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
      if (!blob) throw new Error("no blob");
      setPhoto(new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
    } catch {
      setError("couldn't read that image — try a different file");
    }
  }
  const [installer, setInstaller] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    if (!name.trim() || !password.trim()) return;
    setBusy(true);
    setCopied(false);
    setError(null);
    const form = new FormData();
    form.set("name", name);
    form.set("style", style);
    form.set("password", password);
    if (photo) form.set("photo", photo);
    const res = await fetch("/api/invite", { method: "POST", body: form });
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
          <label style={{ display: "block", fontFamily: script, fontWeight: 700, fontSize: "24px", margin: "18px 0 10px" }}>
            a photo for your polaroid?{" "}
            <span style={{ fontSize: "0.75em", fontWeight: 600, opacity: 0.75 }}>— optional, square looks best</span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptPhoto(e.dataTransfer.files?.[0] ?? null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              padding: "10px",
              margin: "-10px",
              outline: dragging ? `3px dashed ${ink}` : "none",
              background: dragging ? "rgba(255,253,245,0.55)" : "transparent",
            }}
          >
            <label
              style={{
                display: "inline-block",
                fontFamily: slab,
                fontWeight: 600,
                fontSize: "15px",
                padding: "9px 16px",
                background: "#FFFDF5",
                color: ink,
                border: `2px solid ${ink}`,
                boxShadow: "2px 2px 0 rgba(45,42,38,0.5)",
                cursor: "pointer",
                transform: "rotate(-0.4deg)",
              }}
            >
              {dragging ? "drop it! 📷" : photo ? "swap the photo" : "pick or drop a photo 📷"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => acceptPhoto(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
            {photo && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: script, fontWeight: 600, fontSize: "20px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(photo)}
                  alt=""
                  style={{ width: "44px", height: "44px", objectFit: "cover", border: "3px solid #FFFDF5", boxShadow: "1px 2px 6px rgba(45,42,38,0.35)", transform: "rotate(2deg)" }}
                />
                {photo.name}
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  aria-label="remove photo"
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: script, fontWeight: 700, fontSize: "20px", color: ink, padding: 0 }}
                >
                  ✕
                </button>
              </span>
            )}
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
              done, {name.trim().split(/\s+/)[0]}! here&apos;s your kit ✉
            </p>
            <p style={{ margin: "8px 0 14px", fontFamily: slab, fontSize: "15.5px", lineHeight: 1.55 }}>
              Paste the whole thing into Claude Code or Codex — either works.
              Your agent installs the three skills for both tools (the shelf,
              how we like to learn, and the template library), then helps you
              start your first doc.
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
