// The dojo, client side. A published learning doc is a self-contained HTML file
// in somebody's chosen template — cream and cobalt, or black and acid green, or
// a retro Windows pastiche — and a coding exercise dropped into it has to look
// like it was always part of that document. So this file renders ZERO colors of
// its own: every paint comes from a --dojo-* custom property the doc declares,
// and the fallback in each var() is only there so a doc that forgot one still
// reads. Same reason every selector is scoped under .dojo-challenge / .dojo-*:
// the host document's CSS is somebody's design work, and we are a guest in it.
//
// What it does, in order:
//   1. finds <section class="dojo-challenge"> blocks and reads the authored
//      starter / tests / solution out of their <script type="text/plain"> tags
//   2. builds a textarea-over-highlighted-<pre> editor per challenge, with its
//      own hand-written tokenizer per language (js, ts, python, rust, go)
//   3. runs tests — js/ts inside a Web Worker so user code can never reach the
//      DOM, everything else on POST /api/dojo/run — and parses both through the
//      SAME line protocol so results render identically
//   4. reports what happened to /api/dojo/submit, including every plain Run,
//      because that history is what lets the learner's coaching agent read the
//      actual code they wrote instead of asking them to paste it back
//
// No imports, no build step, no dependencies. It is served verbatim from
// /dojo/runtime.js and injected into documents we do not control.

(function () {
  "use strict";

  // Injected twice (a doc with two script tags, a hot reload) must not build two
  // editors over the same textarea.
  if (window.__DOJO_RUNTIME__) return;

  // ── Constants ──────────────────────────────────────────────────────────

  var VERSION = "1.0.0";
  var RUN_TIMEOUT_MS = 4000; // wall clock for the worker; infinite loops happen
  var SAVE_DEBOUNCE_MS = 400;
  var HIGHLIGHT_LIMIT = 20000; // above this we serve plaintext rather than jank
  var MIN_LINES = 10;
  var MAX_LINES = 34;
  var STYLE_ID = "dojo-runtime-style";

  var LANGS = { ts: 1, js: 1, python: 1, rust: 1, go: 1 };
  var BROWSER_LANGS = { ts: 1, js: 1 }; // everything else needs the server

  var LANG_LABEL = {
    ts: "TypeScript",
    js: "JavaScript",
    python: "Python",
    rust: "Rust",
    go: "Go",
  };

  // ── Small utilities ────────────────────────────────────────────────────

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Authored code sits inside HTML indented to match its surroundings, so the
  // raw textContent arrives with a phantom indent on every line. Strip the
  // common prefix (ignoring blank lines, which have none) so line 1 starts at
  // column 0 and the learner's own indentation is the only indentation shown.
  function dedent(raw) {
    if (!raw) return "";
    var text = String(raw).replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\s+$/, "");
    var lines = text.split("\n");
    var min = Infinity;
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var m = lines[i].match(/^[ \t]*/)[0];
      // A tab counts as one unit here; mixed indentation is the author's problem,
      // and we only ever remove a prefix that literally every line shares.
      if (m.length < min) min = m.length;
    }
    if (!isFinite(min) || min === 0) return lines.join("\n");
    for (var j = 0; j < lines.length; j++) lines[j] = lines[j].slice(min);
    return lines.join("\n");
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        fn.apply(self, args);
      }, ms);
    };
  }

  // localStorage is a nice-to-have (private windows, quota, file:// docs all
  // fail differently), so every access is wrapped and every failure is silent.
  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* full, blocked, or unavailable — the editor still works */
    }
  }

  function lsDel(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  }

  function fmtMs(ms) {
    if (ms == null || !isFinite(ms)) return "";
    if (ms < 1000) return Math.round(ms) + "ms";
    return (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + "s";
  }

  function fmtDuration(ms) {
    var s = Math.round((ms || 0) / 1000);
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m " + (s % 60) + "s";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  function countLines(text) {
    var n = 1;
    for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
  }

  // Fire-and-forget POST. Recording must never block typing and must never turn
  // a dead endpoint into a broken page, so this swallows everything.
  function postJSON(url, body) {
    try {
      return fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(function () {
        return null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // ── Stylesheet ─────────────────────────────────────────────────────────

  // One <style>, injected once. Everything is scoped under .dojo-challenge or
  // the dojo- prefix; there is not a single bare element selector, nothing
  // touches html/body, and every value that paints is a var() with a fallback.
  var CSS = [
    ".dojo-challenge{",
    "  --dojo-_paper:var(--dojo-paper,#ffffff);",
    "  --dojo-_ink:var(--dojo-ink,#14161a);",
    "  --dojo-_accent:var(--dojo-accent,#2b4de0);",
    "  --dojo-_muted:var(--dojo-muted,#6b7280);",
    "  --dojo-_line:var(--dojo-line,rgba(20,22,26,0.14));",
    "  --dojo-_pass:var(--dojo-pass,#1a7f4b);",
    "  --dojo-_fail:var(--dojo-fail,#c02626);",
    "  --dojo-_code-bg:var(--dojo-code-bg,rgba(20,22,26,0.04));",
    "  --dojo-_code-ink:var(--dojo-code-ink,var(--dojo-_ink));",
    "  --dojo-_mono:var(--dojo-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);",
    "  --dojo-_body:var(--dojo-font-body,inherit);",
    "  --dojo-_radius:var(--dojo-radius,10px);",
    // The syntax colors get aliases too, for one specific reason: Monaco cannot
    // take a var() — it wants concrete hex — so the upgrade path resolves these
    // with getComputedStyle. Aliasing them here means the fallback chain lives in
    // exactly one place (this stylesheet) and both renderers read the same value.
    "  --dojo-_syn-keyword:var(--dojo-syn-keyword,var(--dojo-_accent));",
    "  --dojo-_syn-string:var(--dojo-syn-string,#0a7c5a);",
    "  --dojo-_syn-comment:var(--dojo-syn-comment,var(--dojo-_muted));",
    "  --dojo-_syn-number:var(--dojo-syn-number,#a2560f);",
    "  --dojo-_syn-fn:var(--dojo-syn-fn,#5b3ac4);",
    "  --dojo-_syn-type:var(--dojo-syn-type,#1f6f8b);",
    "  --dojo-_syn-punct:var(--dojo-syn-punct,var(--dojo-_muted));",
    "  display:block;",
    "}",

    // The frame. Border and paper come from the doc, so in a flat template it
    // reads as a hairline box and in a heavy one it reads as a slab.
    ".dojo-challenge .dojo-shell{",
    "  border:1px solid var(--dojo-_line);",
    "  border-radius:var(--dojo-_radius);",
    "  background:var(--dojo-_paper);",
    "  color:var(--dojo-_ink);",
    "  font-family:var(--dojo-_body);",
    "  overflow:hidden;",
    "  margin:1.25rem 0;",
    "}",
    ".dojo-challenge .dojo-head{",
    "  display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem .75rem;",
    "  padding:.7rem .9rem;border-bottom:1px solid var(--dojo-_line);",
    "}",
    ".dojo-challenge .dojo-title{font-weight:600;font-size:1rem;line-height:1.3;margin:0;}",
    ".dojo-challenge .dojo-meta{",
    "  display:flex;flex-wrap:wrap;gap:.35rem;margin-left:auto;",
    "  font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--dojo-_muted);",
    "}",
    ".dojo-challenge .dojo-tag{",
    "  border:1px solid var(--dojo-_line);border-radius:calc(var(--dojo-_radius) / 2);",
    "  padding:.1rem .4rem;white-space:nowrap;",
    "}",
    ".dojo-challenge .dojo-tag--shape{color:var(--dojo-_accent);border-color:currentColor;}",
    ".dojo-challenge .dojo-solvedbadge{",
    "  color:var(--dojo-_pass);border-color:currentColor;font-weight:600;",
    "}",
    ".dojo-challenge .dojo-brief{padding:0 .9rem;}",

    // ── Editor ──
    // The gutter and the code share one horizontal row; only the code scrolls.
    ".dojo-challenge .dojo-editor{",
    "  display:flex;align-items:stretch;",
    "  background:var(--dojo-_code-bg);",
    "  border-top:1px solid var(--dojo-_line);",
    "  border-bottom:1px solid var(--dojo-_line);",
    "  position:relative;",
    "}",
    ".dojo-challenge .dojo-gutter{",
    "  flex:0 0 auto;overflow:hidden;text-align:right;",
    "  padding:.7rem .5rem .7rem .7rem;",
    "  color:var(--dojo-_muted);opacity:.65;",
    "  border-right:1px solid var(--dojo-_line);",
    "  user-select:none;-webkit-user-select:none;pointer-events:none;",
    "}",
    ".dojo-challenge .dojo-gutter,.dojo-challenge .dojo-pre,.dojo-challenge .dojo-ta{",
    // THE alignment contract. Every metric that affects glyph position lives in
    // this one rule so the transparent textarea and the highlighted <pre> can
    // never drift apart. Changing a value here changes it for both layers.
    "  font-family:var(--dojo-_mono);",
    "  font-size:.86rem;",
    "  line-height:1.55;",
    "  letter-spacing:0;",
    "  font-variant-ligatures:none;",
    "  -webkit-font-smoothing:auto;",
    "  tab-size:2;-moz-tab-size:2;",
    "  white-space:pre;",
    "  font-weight:400;",
    "  font-style:normal;",
    "}",
    ".dojo-challenge .dojo-codewrap{position:relative;flex:1 1 auto;min-width:0;}",
    ".dojo-challenge .dojo-pre{",
    "  margin:0;padding:.7rem .9rem;",
    "  overflow:hidden;", // scrolled programmatically to mirror the textarea
    "  color:var(--dojo-_code-ink);",
    "  background:transparent;border:0;",
    "  pointer-events:none;",
    "  height:100%;box-sizing:border-box;",
    "}",
    ".dojo-challenge .dojo-pre code{font:inherit;letter-spacing:inherit;background:none;padding:0;border:0;color:inherit;white-space:pre;}",
    ".dojo-challenge .dojo-ta{",
    "  position:absolute;inset:0;width:100%;height:100%;",
    "  margin:0;padding:.7rem .9rem;",
    "  border:0;outline:0;resize:none;display:block;box-sizing:border-box;",
    "  background:transparent;",
    "  color:transparent;", // the <pre> underneath is what you actually read
    "  caret-color:var(--dojo-_ink);",
    "  -webkit-text-fill-color:transparent;",
    "  overflow:auto;",
    "}",
    // Selection has to stay visible even though the text is invisible: a
    // translucent accent wash reads on both light and dark papers.
    ".dojo-challenge .dojo-ta::selection{background:color-mix(in srgb,var(--dojo-_accent) 28%,transparent);color:transparent;-webkit-text-fill-color:transparent;}",
    ".dojo-challenge .dojo-ta::-moz-selection{background:var(--dojo-_accent);color:transparent;}",
    ".dojo-challenge .dojo-ta:focus-visible{outline:0;}",
    ".dojo-challenge .dojo-editor:focus-within{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dojo-_accent) 45%,transparent);}",
    // Read-only code (predict challenges, revealed solutions) is the same
    // <pre>, without a textarea over it.
    ".dojo-challenge .dojo-readonly{",
    "  margin:0;padding:.7rem .9rem;overflow:auto;",
    "  background:var(--dojo-_code-bg);color:var(--dojo-_code-ink);",
    "  border-top:1px solid var(--dojo-_line);border-bottom:1px solid var(--dojo-_line);",
    "}",

    // ── Syntax colors ──
    // Via the aliases above, so the textarea highlighter and Monaco's theme are
    // reading the same resolved value rather than two copies of a fallback.
    ".dojo-challenge .dojo-t-kw{color:var(--dojo-_syn-keyword);}",
    ".dojo-challenge .dojo-t-str{color:var(--dojo-_syn-string);}",
    ".dojo-challenge .dojo-t-com{color:var(--dojo-_syn-comment);font-style:italic;}",
    ".dojo-challenge .dojo-t-num{color:var(--dojo-_syn-number);}",
    ".dojo-challenge .dojo-t-fn{color:var(--dojo-_syn-fn);}",
    ".dojo-challenge .dojo-t-type{color:var(--dojo-_syn-type);}",
    ".dojo-challenge .dojo-t-punct{color:var(--dojo-_syn-punct);}",

    // ── The Monaco container ──
    // Same border and paper as the textarea editor it replaces, so the swap is a
    // change of engine and not a change of design. Height is set in JS from the
    // content size; the min-height here is only what shows during construction.
    ".dojo-challenge .dojo-monaco{",
    "  border-top:1px solid var(--dojo-_line);",
    "  border-bottom:1px solid var(--dojo-_line);",
    "  background:var(--dojo-_code-bg);",
    "  min-height:6rem;width:100%;overflow:hidden;",
    "}",
    // CSS bleed runs both ways, and inward is the dangerous direction: a template
    // that sets `letter-spacing` or `text-transform` broadly will hit Monaco's
    // internal spans, and Monaco measures its character cell ONCE — so anything
    // that changes glyph advance after that measurement misaligns every column.
    // This resets only the properties that move text, and only inside our own
    // container. Deliberately not box-sizing: Monaco's own layout depends on it.
    ".dojo-challenge .dojo-monaco .monaco-editor,.dojo-challenge .dojo-monaco .monaco-editor *{",
    // (font-style is NOT reset here: the theme's italic comments come through as
    // a font-style on Monaco's own token classes, and this selector would win.)
    "  letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;",
    "  font-variant:normal;font-feature-settings:normal;text-align:left;",
    "}",
    ".dojo-challenge .dojo-monaco .monaco-editor .margin{background:transparent;}",
    ".dojo-challenge .dojo-upgrading{",
    "  font-size:.72rem;color:var(--dojo-_muted);font-style:italic;",
    "}",

    // ── Controls ──
    ".dojo-challenge .dojo-bar{",
    "  display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;",
    "  padding:.6rem .9rem;",
    "}",
    ".dojo-challenge .dojo-btn{",
    "  font:inherit;font-size:.8rem;font-family:var(--dojo-_body);",
    "  padding:.36rem .7rem;cursor:pointer;",
    "  border:1px solid var(--dojo-_line);",
    "  border-radius:calc(var(--dojo-_radius) / 1.6);",
    "  background:transparent;color:var(--dojo-_ink);",
    "  line-height:1.4;",
    "}",
    ".dojo-challenge .dojo-btn:hover:not(:disabled){border-color:var(--dojo-_accent);color:var(--dojo-_accent);}",
    ".dojo-challenge .dojo-btn:focus-visible{outline:2px solid var(--dojo-_accent);outline-offset:2px;}",
    ".dojo-challenge .dojo-btn:disabled{opacity:.5;cursor:default;}",
    ".dojo-challenge .dojo-btn--primary{",
    "  background:var(--dojo-_accent);border-color:var(--dojo-_accent);",
    "  color:var(--dojo-paper,#ffffff);font-weight:600;",
    "}",
    ".dojo-challenge .dojo-btn--primary:hover:not(:disabled){color:var(--dojo-paper,#ffffff);opacity:.88;}",
    ".dojo-challenge .dojo-spacer{margin-left:auto;}",
    ".dojo-challenge .dojo-clock{font-size:.72rem;color:var(--dojo-_muted);font-variant-numeric:tabular-nums;}",
    ".dojo-challenge .dojo-readonly-note{",
    "  padding:0 .9rem .6rem;font-size:.74rem;color:var(--dojo-_muted);",
    "}",

    // ── Results ──
    ".dojo-challenge .dojo-results{padding:0 .9rem .8rem;font-size:.82rem;}",
    ".dojo-challenge .dojo-results:empty{display:none;}",
    ".dojo-challenge .dojo-summary{",
    "  display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;",
    "  padding:.5rem .6rem;margin-bottom:.5rem;",
    "  border:1px solid var(--dojo-_line);border-radius:calc(var(--dojo-_radius) / 1.6);",
    "}",
    ".dojo-challenge .dojo-summary--green{border-color:var(--dojo-_accent);color:var(--dojo-_accent);}",
    ".dojo-challenge .dojo-summary--red{border-color:var(--dojo-_fail);}",
    ".dojo-challenge .dojo-count{font-weight:600;}",
    ".dojo-challenge .dojo-where{font-size:.72rem;color:var(--dojo-_muted);margin-left:auto;font-variant-numeric:tabular-nums;}",
    ".dojo-challenge .dojo-note{font-size:.76rem;color:var(--dojo-_muted);margin:0 0 .45rem;}",
    ".dojo-challenge .dojo-testlist{list-style:none;margin:0 0 .5rem;padding:0;}",
    ".dojo-challenge .dojo-test{display:flex;gap:.5rem;padding:.22rem 0;align-items:flex-start;}",
    ".dojo-challenge .dojo-test-mark{flex:0 0 auto;font-family:var(--dojo-_mono);font-size:.8rem;}",
    ".dojo-challenge .dojo-test--pass .dojo-test-mark{color:var(--dojo-_pass);}",
    ".dojo-challenge .dojo-test--fail .dojo-test-mark,.dojo-challenge .dojo-test--error .dojo-test-mark{color:var(--dojo-_fail);}",
    ".dojo-challenge .dojo-test-body{min-width:0;}",
    ".dojo-challenge .dojo-test-name{display:block;}",
    ".dojo-challenge .dojo-test--fail .dojo-test-name,.dojo-challenge .dojo-test--error .dojo-test-name{color:var(--dojo-_fail);}",
    ".dojo-challenge .dojo-test-msg{",
    "  display:block;font-family:var(--dojo-_mono);font-size:.76rem;",
    "  color:var(--dojo-_muted);white-space:pre-wrap;word-break:break-word;margin-top:.1rem;",
    "}",
    ".dojo-challenge .dojo-outblock{margin:.45rem 0 0;}",
    ".dojo-challenge .dojo-outlabel{",
    "  font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;",
    "  color:var(--dojo-_muted);margin-bottom:.2rem;",
    "}",
    ".dojo-challenge .dojo-outpre{",
    "  margin:0;padding:.5rem .6rem;max-height:16rem;overflow:auto;",
    "  font-family:var(--dojo-_mono);font-size:.78rem;line-height:1.5;",
    "  background:var(--dojo-_code-bg);color:var(--dojo-_code-ink);",
    "  border:1px solid var(--dojo-_line);border-radius:calc(var(--dojo-_radius) / 1.6);",
    "  white-space:pre;",
    "}",
    ".dojo-challenge .dojo-outpre--err{color:var(--dojo-_fail);}",
    ".dojo-challenge .dojo-pending{color:var(--dojo-_muted);font-size:.8rem;padding:.3rem 0;}",

    // The whole celebration: the frame adopts the accent for a beat. No confetti,
    // no bounce — restraint is the point, and it degrades to nothing under
    // prefers-reduced-motion.
    ".dojo-challenge .dojo-shell--green{border-color:var(--dojo-_accent);}",
    "@media (prefers-reduced-motion:no-preference){",
    "  .dojo-challenge .dojo-shell--green{animation:dojo-glow 900ms ease-out 1;}",
    "  @keyframes dojo-glow{",
    "    0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dojo-_accent) 40%,transparent);}",
    "    100%{box-shadow:0 0 0 10px color-mix(in srgb,var(--dojo-_accent) 0%,transparent);}",
    "  }",
    "}",

    // ── Answer box (predict shape) ──
    ".dojo-challenge .dojo-answer{padding:.6rem .9rem;display:grid;gap:.4rem;}",
    ".dojo-challenge .dojo-answer label{font-size:.76rem;color:var(--dojo-_muted);}",
    ".dojo-challenge .dojo-answer textarea{",
    "  font-family:var(--dojo-_mono);font-size:.84rem;line-height:1.5;",
    "  padding:.5rem .6rem;min-height:4.5rem;resize:vertical;",
    "  background:var(--dojo-_code-bg);color:var(--dojo-_code-ink);",
    "  border:1px solid var(--dojo-_line);border-radius:calc(var(--dojo-_radius) / 1.6);",
    "}",
    ".dojo-challenge .dojo-answer textarea:focus-visible{outline:2px solid var(--dojo-_accent);outline-offset:1px;}",

    // ── Status strip ──
    ".dojo-strip{",
    "  display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;",
    "  font-family:var(--dojo-font-body,inherit);font-size:.76rem;",
    "  color:var(--dojo-muted,#6b7280);",
    "  border:1px solid var(--dojo-line,rgba(20,22,26,0.14));",
    "  border-radius:var(--dojo-radius,10px);",
    "  padding:.4rem .7rem;margin:1rem 0;",
    "  background:var(--dojo-paper,transparent);",
    "}",
    ".dojo-strip .dojo-strip-count{font-weight:600;color:var(--dojo-ink,#14161a);font-variant-numeric:tabular-nums;}",
    ".dojo-strip .dojo-strip-bar{",
    "  flex:1 1 6rem;min-width:4rem;height:4px;overflow:hidden;",
    "  border-radius:999px;background:var(--dojo-code-bg,rgba(20,22,26,0.08));",
    "}",
    ".dojo-strip .dojo-strip-fill{",
    "  display:block;height:100%;width:0;",
    "  background:var(--dojo-accent,#2b4de0);",
    "}",
    "@media (prefers-reduced-motion:no-preference){",
    "  .dojo-strip .dojo-strip-fill{transition:width 400ms ease;}",
    "}",
    ".dojo-strip .dojo-strip-all{color:var(--dojo-accent,#2b4de0);font-weight:600;}",

    // ── Narrow screens ──
    "@media (max-width:480px){",
    "  .dojo-challenge .dojo-head,.dojo-challenge .dojo-bar{padding-left:.6rem;padding-right:.6rem;}",
    "  .dojo-challenge .dojo-results,.dojo-challenge .dojo-brief{padding-left:.6rem;padding-right:.6rem;}",
    "  .dojo-challenge .dojo-meta{margin-left:0;}",
    "  .dojo-challenge .dojo-btn{flex:1 1 auto;text-align:center;}",
    "}",
  ].join("\n");

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = el("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── Syntax highlighting ────────────────────────────────────────────────
  //
  // Five small hand-written scanners rather than one pile of regexes. The reason
  // is boring and decisive: a regex sweep cannot know that the `//` inside
  // "http://x" is not a comment, or that the quote inside `/* don't */` is not a
  // string. So each language gets a left-to-right character scan that carries
  // state — and because every branch either consumes at least one character or
  // falls through to the default, the output text is always byte-identical to
  // the input once HTML escaping is undone. That invariant is what keeps the
  // highlighted <pre> aligned under the textarea.

  var WORDS = {
    js: {
      kw: "await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield async",
      lit: "true false null undefined NaN Infinity",
      type: "Array Object String Number Boolean Symbol BigInt Promise Map Set WeakMap WeakSet Date RegExp Error TypeError RangeError SyntaxError JSON Math console globalThis Function Proxy Reflect ArrayBuffer Uint8Array Int32Array Float64Array",
    },
    ts: {
      kw: "abstract any as asserts await break case catch class const constructor continue declare default delete do else enum export extends finally for from function get if implements import in infer instanceof interface is keyof let module namespace never new of out override private protected public readonly return satisfies set static super switch this throw try type typeof unique unknown var void while with yield async accessor",
      lit: "true false null undefined NaN Infinity",
      type: "string number boolean object symbol bigint Array Object String Number Boolean Symbol BigInt Promise Map Set WeakMap WeakSet Date RegExp Error JSON Math Record Partial Required Readonly Pick Omit Exclude Extract NonNullable ReturnType Parameters Awaited console globalThis",
    },
    python: {
      kw: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case",
      lit: "True False None NotImplemented Ellipsis self cls",
      type: "int float str bool bytes bytearray list dict set frozenset tuple complex object type range enumerate zip map filter len print sum min max abs sorted reversed any all isinstance issubclass getattr setattr hasattr super property staticmethod classmethod Exception ValueError TypeError KeyError IndexError RuntimeError StopIteration open repr format iter next round divmod id hash callable",
    },
    rust: {
      kw: "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while box union yield",
      lit: "true false None Some Ok Err",
      type: "i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box Rc Arc RefCell Cell HashMap HashSet BTreeMap BTreeSet VecDeque Iterator IntoIterator Clone Copy Debug Display Default Drop Fn FnMut FnOnce Send Sync Sized PhantomData Cow Mutex RwLock",
    },
    go: {
      kw: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var",
      lit: "true false nil iota",
      type: "bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any append cap close copy delete len make new panic print println recover make",
    },
  };

  // Turn the space-separated lists above into lookup maps, once.
  var LOOKUP = {};
  (function buildLookups() {
    for (var lang in WORDS) {
      if (!Object.prototype.hasOwnProperty.call(WORDS, lang)) continue;
      var set = { kw: {}, lit: {}, type: {} };
      for (var group in WORDS[lang]) {
        if (!Object.prototype.hasOwnProperty.call(WORDS[lang], group)) continue;
        var list = WORDS[lang][group].split(" ");
        for (var i = 0; i < list.length; i++) if (list[i]) set[group][list[i]] = true;
      }
      LOOKUP[lang] = set;
    }
  })();

  function pushTok(out, cls, text) {
    if (!text) return;
    if (!cls) {
      out.push(escapeHtml(text));
      return;
    }
    out.push('<span class="dojo-t-' + cls + '">' + escapeHtml(text) + "</span>");
  }

  function isIdentStart(ch) {
    return /[A-Za-z_$À-￿]/.test(ch);
  }
  function isIdentPart(ch) {
    return /[A-Za-z0-9_$À-￿]/.test(ch);
  }
  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }
  var PUNCT = "+-*/%=<>!&|^~?:;,.()[]{}@#\\";

  // Numbers, all five languages at once: 0x/0b/0o prefixes, digit separators
  // (_ in js/rust/python, none in go but harmless), decimals, exponents, and
  // trailing suffixes (rust's i32/f64, js's n, go's imaginary i).
  function scanNumber(src, i) {
    var n = src.length;
    var start = i;
    if (src[i] === "0" && i + 1 < n && /[xXbBoO]/.test(src[i + 1])) {
      i += 2;
      while (i < n && /[0-9a-fA-F_]/.test(src[i])) i++;
    } else {
      while (i < n && (isDigit(src[i]) || src[i] === "_")) i++;
      if (i < n && src[i] === "." && isDigit(src[i + 1] || "")) {
        i++;
        while (i < n && (isDigit(src[i]) || src[i] === "_")) i++;
      }
      if (i < n && /[eE]/.test(src[i]) && /[0-9+\-]/.test(src[i + 1] || "")) {
        i += 2;
        while (i < n && isDigit(src[i])) i++;
      }
    }
    // Suffix: i32, u8, f64, usize, n (BigInt), i (Go imaginary).
    var suffix = /^(?:[iuf](?:8|16|32|64|128|size)|n|i)/.exec(src.slice(i));
    if (suffix && !isIdentPart(src[i + suffix[0].length] || "")) i += suffix[0].length;
    return { end: i, text: src.slice(start, i) };
  }

  // A quoted run with backslash escapes, tolerant of running off the end (the
  // learner is mid-keystroke half the time, and an unterminated string must not
  // swallow the rest of the file into one span... but it must not loop either,
  // so an unterminated literal simply ends at the newline for ' and ").
  function scanQuoted(src, i, quote, multiline) {
    var n = src.length;
    var start = i;
    i++;
    while (i < n) {
      var ch = src[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) {
        i++;
        break;
      }
      if (ch === "\n" && !multiline) break;
      i++;
    }
    return { end: i, text: src.slice(start, i) };
  }

  // Find the index just past the `}` that closes a `${` / `{` interpolation,
  // counting nested braces and skipping quoted runs so `${ {a:"}"} }` works.
  function matchBrace(src, i) {
    var depth = 0;
    var n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        i = scanQuoted(src, i, ch, ch === "`").end;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return n;
  }

  // The C-family scanner: js, ts, rust, go. The per-language differences are
  // small enough (raw strings, lifetimes, macros, template literals) that one
  // scanner with flags stays more honest than four near-copies.
  function tokenizeCLike(src, lang, out) {
    var words = LOOKUP[lang] || LOOKUP.js;
    var isJsish = lang === "js" || lang === "ts";
    var isRust = lang === "rust";
    var isGo = lang === "go";
    var n = src.length;
    var i = 0;
    var plain = ""; // run of characters with no class, flushed lazily

    function flush() {
      if (plain) {
        pushTok(out, null, plain);
        plain = "";
      }
    }

    while (i < n) {
      var ch = src[i];
      var next = src[i + 1] || "";

      // Comments.
      if (ch === "/" && next === "/") {
        flush();
        var eol = src.indexOf("\n", i);
        if (eol < 0) eol = n;
        pushTok(out, "com", src.slice(i, eol));
        i = eol;
        continue;
      }
      if (ch === "/" && next === "*") {
        flush();
        var close = src.indexOf("*/", i + 2);
        var stop = close < 0 ? n : close + 2;
        pushTok(out, "com", src.slice(i, stop));
        i = stop;
        continue;
      }

      // Rust/Go raw strings: r"…", r#"…"#, b"…", and Go's backticked run.
      if (isRust && (ch === "r" || ch === "b") && /^[rb]?#*"/.test(src.slice(i, i + 8))) {
        var m = /^[rb]{1,2}(#*)"/.exec(src.slice(i));
        if (m) {
          var hashes = m[1];
          var terminator = '"' + hashes;
          var from = i + m[0].length;
          var at = src.indexOf(terminator, from);
          var rend = at < 0 ? n : at + terminator.length;
          flush();
          pushTok(out, "str", src.slice(i, rend));
          i = rend;
          continue;
        }
      }
      if (isGo && ch === "`") {
        flush();
        var gclose = src.indexOf("`", i + 1);
        var gend = gclose < 0 ? n : gclose + 1;
        pushTok(out, "str", src.slice(i, gend));
        i = gend;
        continue;
      }

      // Rust lifetimes ('a, 'static) read as types; a rune/char literal ('x',
      // '\n') reads as a string. They are told apart by what follows the word.
      if ((isRust || isGo) && ch === "'") {
        var life = /^'([A-Za-z_][A-Za-z0-9_]*)(?!')/.exec(src.slice(i));
        if (isRust && life && src[i + life[0].length] !== "'") {
          flush();
          pushTok(out, "type", life[0]);
          i += life[0].length;
          continue;
        }
        var rune = scanQuoted(src, i, "'", false);
        flush();
        pushTok(out, "str", rune.text);
        i = rune.end;
        continue;
      }

      // Strings. Template literals get their ${…} interpolations scanned
      // recursively, which is the only way `${count + 1}` looks like code.
      if (ch === '"' || (isJsish && ch === "'")) {
        var q = scanQuoted(src, i, ch, false);
        flush();
        pushTok(out, "str", q.text);
        i = q.end;
        continue;
      }
      if (isJsish && ch === "`") {
        flush();
        i = tokenizeTemplate(src, i, lang, out);
        continue;
      }

      // Numbers.
      if (isDigit(ch) || (ch === "." && isDigit(next))) {
        var num = scanNumber(src, i);
        if (num.end > i) {
          flush();
          pushTok(out, "num", num.text);
          i = num.end;
          continue;
        }
      }

      // Identifiers, keywords, types, call names, macros.
      if (isIdentStart(ch)) {
        var j = i;
        while (j < n && isIdentPart(src[j])) j++;
        var word = src.slice(i, j);
        var after = src.slice(j);
        var callish = /^\s*[(<]/.test(after) && !/^\s*<[=<]/.test(after);
        var cls = null;
        if (words.kw[word]) cls = "kw";
        else if (words.lit[word]) cls = "kw";
        else if (words.type[word]) cls = "type";
        else if (isRust && after.charAt(0) === "!" && after.charAt(1) !== "=") cls = "fn"; // vec!, println!
        else if (callish) cls = "fn";
        else if (/^[A-Z]/.test(word) && (isRust || isGo || lang === "ts")) cls = "type";
        if (cls) {
          flush();
          pushTok(out, cls, word);
        } else {
          plain += word;
        }
        i = j;
        continue;
      }

      // Punctuation, greedily grouped so operators are one span, not five.
      if (PUNCT.indexOf(ch) >= 0) {
        var k = i;
        while (k < n && PUNCT.indexOf(src[k]) >= 0) {
          // Stop before something that starts a comment or a raw literal so the
          // branches above get their turn.
          if (src[k] === "/" && (src[k + 1] === "/" || src[k + 1] === "*") && k > i) break;
          k++;
        }
        flush();
        pushTok(out, "punct", src.slice(i, k));
        i = k;
        continue;
      }

      plain += ch;
      i++;
    }
    flush();
  }

  // A template literal: string chunks in the string color, ${…} scanned as code.
  function tokenizeTemplate(src, i, lang, out) {
    var n = src.length;
    var chunk = i;
    i++;
    while (i < n) {
      var ch = src[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "$" && src[i + 1] === "{") {
        pushTok(out, "str", src.slice(chunk, i));
        var end = matchBrace(src, i + 1);
        pushTok(out, "punct", "${");
        tokenizeCLike(src.slice(i + 2, Math.max(i + 2, end - 1)), lang, out);
        pushTok(out, "punct", src.slice(end - 1, end) === "}" ? "}" : "");
        i = end;
        chunk = i;
        continue;
      }
      if (ch === "`") {
        i++;
        break;
      }
      i++;
    }
    pushTok(out, "str", src.slice(chunk, i));
    return i;
  }

  // Python: `#` comments, triple-quoted blocks, prefixed literals (f/r/b/u and
  // their combinations), decorators, and f-string {…} holes scanned as code.
  function tokenizePython(src, out) {
    var words = LOOKUP.python;
    var n = src.length;
    var i = 0;
    var plain = "";

    function flush() {
      if (plain) {
        pushTok(out, null, plain);
        plain = "";
      }
    }

    while (i < n) {
      var ch = src[i];

      if (ch === "#") {
        flush();
        var eol = src.indexOf("\n", i);
        if (eol < 0) eol = n;
        pushTok(out, "com", src.slice(i, eol));
        i = eol;
        continue;
      }

      // A string, possibly with a prefix and possibly triple-quoted.
      var lit = /^([rRbBuUfF]{0,2})("""|'''|"|')/.exec(src.slice(i));
      if (lit) {
        var prefix = lit[1];
        var quote = lit[2];
        var isF = /[fF]/.test(prefix);
        var bodyStart = i + lit[0].length;
        var end = bodyStart;
        var triple = quote.length === 3;
        var terminated = false;
        while (end < n) {
          if (src[end] === "\\" && !/[rR]/.test(prefix)) {
            end += 2;
            continue;
          }
          if (src.slice(end, end + quote.length) === quote) {
            end += quote.length;
            terminated = true;
            break;
          }
          if (!triple && src[end] === "\n") break;
          end++;
        }
        if (!terminated && end > n) end = n;
        flush();
        if (isF) {
          // f-string: literal parts colored as string, {expr} holes recursed so
          // f"{user.name!r}" shows its expression.
          var seg = i;
          var p = bodyStart;
          var stop = end;
          while (p < stop) {
            if (src[p] === "{" && src[p + 1] === "{") {
              p += 2;
              continue;
            }
            if (src[p] === "{") {
              pushTok(out, "str", src.slice(seg, p));
              var hole = matchBrace(src, p);
              if (hole > stop) hole = stop;
              pushTok(out, "punct", "{");
              tokenizePython(src.slice(p + 1, Math.max(p + 1, hole - 1)), out);
              pushTok(out, "punct", "}");
              p = hole;
              seg = p;
              continue;
            }
            p++;
          }
          pushTok(out, "str", src.slice(seg, end));
        } else {
          pushTok(out, "str", src.slice(i, end));
        }
        i = end;
        continue;
      }

      // Decorators: @staticmethod, @app.route(...) — the whole dotted name.
      if (ch === "@" && isIdentStart(src[i + 1] || "")) {
        var dec = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))[0];
        flush();
        pushTok(out, "fn", dec);
        i += dec.length;
        continue;
      }

      if (isDigit(ch) || (ch === "." && isDigit(src[i + 1] || ""))) {
        var num = scanNumber(src, i);
        if (num.end > i) {
          flush();
          pushTok(out, "num", num.text);
          i = num.end;
          continue;
        }
      }

      if (isIdentStart(ch)) {
        var j = i;
        while (j < n && isIdentPart(src[j])) j++;
        var word = src.slice(i, j);
        var cls = null;
        if (words.kw[word]) cls = "kw";
        else if (words.lit[word]) cls = "kw";
        else if (words.type[word]) cls = "type";
        else if (/^\s*\(/.test(src.slice(j))) cls = "fn";
        else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) cls = "type";
        if (cls) {
          flush();
          pushTok(out, cls, word);
        } else {
          plain += word;
        }
        i = j;
        continue;
      }

      if (PUNCT.indexOf(ch) >= 0) {
        var k = i;
        while (k < n && PUNCT.indexOf(src[k]) >= 0 && src[k] !== "#") k++;
        if (k === i) k = i + 1;
        flush();
        pushTok(out, "punct", src.slice(i, k));
        i = k;
        continue;
      }

      plain += ch;
      i++;
    }
    flush();
  }

  // The one entry point the editor calls. Above HIGHLIGHT_LIMIT we hand back
  // escaped plaintext: a 20k-character file re-tokenized on every keystroke is
  // how you make somebody's document feel broken.
  function highlight(code, lang) {
    if (!code) return "";
    if (code.length > HIGHLIGHT_LIMIT) return escapeHtml(code);
    var out = [];
    try {
      if (lang === "python") tokenizePython(code, out);
      else tokenizeCLike(code, LANGS[lang] ? lang : "js", out);
    } catch (e) {
      // A tokenizer bug must degrade to readable code, never to a blank editor.
      return escapeHtml(code);
    }
    return out.join("");
  }

  // ── TypeScript, made runnable ──────────────────────────────────────────
  //
  // Browsers cannot execute .ts, and shipping a real compiler would blow the
  // "zero dependencies" rule and the page weight along with it. So: a careful
  // character-scanning stripper that removes the type layer and leaves the
  // JavaScript underneath byte-for-byte intact.
  //
  // It is a heuristic and it knows it. Enums, constructor parameter properties,
  // and truly exotic conditional types are beyond it. That is fine, because the
  // caller treats a stripper throw OR a SyntaxError from the worker as a signal
  // to re-run the same code on the server — the learner never sees a stripper
  // failure, only a small note that the run happened server-side.

  // Balance a bracket pair starting at `i` (which must be an opener), skipping
  // over strings and comments and recursing into nested pairs. Returns the index
  // just past the closer, or -1 for a `<` that turned out to be a comparison.
  //
  // The recursion is what makes `Array<(v: T) => void>` work: a plain depth
  // counter over `<` and `>` sees the `>` in the fat arrow and closes early.
  function matchPair(src, i) {
    var open = src[i];
    var close = open === "{" ? "}" : open === "(" ? ")" : open === "[" ? "]" : ">";
    var n = src.length;
    i++;
    while (i < n) {
      var ch = src[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        i = scanQuoted(src, i, ch, ch === "`").end;
        continue;
      }
      if (ch === "/" && src[i + 1] === "/") {
        var e = src.indexOf("\n", i);
        i = e < 0 ? n : e;
        continue;
      }
      if (ch === "/" && src[i + 1] === "*") {
        var b = src.indexOf("*/", i + 2);
        i = b < 0 ? n : b + 2;
        continue;
      }
      // Inside a generic argument list, `=>` is a function type, not a closer.
      if (open === "<" && ch === "=" && src[i + 1] === ">") {
        i += 2;
        continue;
      }
      if (ch === close) return i + 1;
      // Only recurse into `<` when we are already in type-land; elsewhere a `<`
      // is a less-than sign.
      if (ch === "(" || ch === "[" || ch === "{" || (open === "<" && ch === "<")) {
        var inner = matchPair(src, i);
        if (inner < 0) return -1;
        i = inner;
        continue;
      }
      if (open === "<" && (ch === ";" || ch === "\n")) {
        // A `<` that never closes on this line was a comparison, not a generic.
        return -1;
      }
      i++;
    }
    return open === "<" ? -1 : n;
  }

  function skipSpace(src, i) {
    var n = src.length;
    while (i < n) {
      if (/\s/.test(src[i])) {
        i++;
        continue;
      }
      if (src[i] === "/" && src[i + 1] === "/") {
        var e = src.indexOf("\n", i);
        i = e < 0 ? n : e;
        continue;
      }
      if (src[i] === "/" && src[i + 1] === "*") {
        var b = src.indexOf("*/", i + 2);
        i = b < 0 ? n : b + 2;
        continue;
      }
      break;
    }
    return i;
  }

  // Consume one type expression. `expectAtom` alternates between "a type may
  // start here" and "a type just ended, only an infix continuation counts".
  // The distinction is what stops `(): string => x` from eating the arrow body:
  // `=>` continues a type only after a parenthesised parameter list.
  function scanType(src, i) {
    var n = src.length;
    var start = i;
    var expectAtom = true;
    var lastWasParen = false;
    var guard = 0;
    while (i < n && guard++ < 5000) {
      i = skipSpace(src, i);
      if (i >= n) break;
      var ch = src[i];

      if (expectAtom) {
        if (ch === "|" || ch === "&") {
          i++;
          continue;
        }
        if (ch === "{" || ch === "(" || ch === "[") {
          var end = matchPair(src, i);
          if (end < 0) break;
          lastWasParen = ch === "(";
          i = end;
          expectAtom = false;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          i = scanQuoted(src, i, ch, ch === "`").end;
          expectAtom = false;
          lastWasParen = false;
          continue;
        }
        if (ch === "-" && isDigit(src[i + 1] || "")) {
          i = scanNumber(src, i + 1).end;
          expectAtom = false;
          continue;
        }
        if (isDigit(ch)) {
          i = scanNumber(src, i).end;
          expectAtom = false;
          continue;
        }
        if (isIdentStart(ch)) {
          var j = i;
          while (j < n && (isIdentPart(src[j]) || src[j] === ".")) j++;
          var word = src.slice(i, j);
          i = j;
          // `typeof x`, `keyof T`, `infer U`, `readonly T[]`, `new () => T`,
          // `asserts x is T` all take another atom after them.
          if (/^(typeof|keyof|infer|readonly|new|asserts|unique|abstract)$/.test(word)) {
            expectAtom = true;
            continue;
          }
          expectAtom = false;
          lastWasParen = false;
          continue;
        }
        break;
      }

      // After an atom.
      if (ch === "|" || ch === "&") {
        i++;
        expectAtom = true;
        continue;
      }
      if (ch === "[") {
        var arr = matchPair(src, i);
        if (arr < 0) break;
        i = arr;
        continue;
      }
      if (ch === "<") {
        var gen = matchPair(src, i);
        if (gen < 0) break;
        i = gen;
        lastWasParen = false;
        continue;
      }
      if (ch === "=" && src[i + 1] === ">" && lastWasParen) {
        i += 2;
        expectAtom = true;
        continue;
      }
      // `extends` (conditional types) and `is` (predicates) continue a type.
      // `in` deliberately does not: it only appears in mapped types, which are
      // inside braces matchPair already swallowed, and treating it as a
      // continuation would eat the collection in `for (const k: string in xs)`.
      if (/^(extends|is)\b/.test(src.slice(i))) {
        i += /^(extends|is)/.exec(src.slice(i))[0].length;
        expectAtom = true;
        continue;
      }
      break;
    }
    // Never hand back a position inside the trivia that FOLLOWS the type. Each
    // pass through the loop begins with skipSpace, so the position we break on
    // is past whatever whitespace preceded the token that stopped us — and the
    // caller deletes everything up to what we return. Eating that whitespace
    // welds the next statement onto this one:
    //
    //   let cached: T        →   let cachedlet cachedAt = -1
    //   let cachedAt = -1
    //
    // because a newline is the only thing standing between them (ASI has nothing
    // else to go on). So back off trailing whitespace, never past the start. A
    // trailing line comment stays consumed, which is harmless — stripped output
    // is fed to the engine, never shown to anyone.
    while (i > start && /\s/.test(src.charAt(i - 1))) i--;
    return i;
  }

  // The statement-level scan. Throws on anything it recognises as unstrippable
  // so the caller can hand the job to the server instead of guessing.
  function stripTypes(src) {
    var n = src.length;
    var out = [];
    var i = 0;
    // Brace stack: "obj" for object literals (where `:` separates a key from a
    // value and must stay) and "block" for everything else (where `:` after an
    // identifier is an annotation and must go).
    var braces = [];
    var ternary = 0;
    var lastSig = ""; // last significant character emitted
    var lastWord = ""; // last identifier/keyword emitted
    var guard = 0;

    function emit(text) {
      out.push(text);
      var trimmed = text.replace(/\s+$/, "");
      if (trimmed) lastSig = trimmed.charAt(trimmed.length - 1);
    }

    // Is the position at `i` the start of a statement? Used so a variable called
    // `type` or a property named `interface` is not mistaken for a declaration.
    function atStatementStart() {
      return lastSig === "" || lastSig === ";" || lastSig === "{" || lastSig === "}" || lastSig === ")";
    }

    while (i < n) {
      if (guard++ > 400000) throw new Error("stripper stalled");
      var ch = src[i];

      // Verbatim regions: comments and every flavour of string. Copying these
      // untouched is the whole reason this is a scanner and not a regex.
      if (ch === "/" && src[i + 1] === "/") {
        var eol = src.indexOf("\n", i);
        if (eol < 0) eol = n;
        out.push(src.slice(i, eol));
        i = eol;
        continue;
      }
      if (ch === "/" && src[i + 1] === "*") {
        var bend = src.indexOf("*/", i + 2);
        var stop = bend < 0 ? n : bend + 2;
        out.push(src.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === '"' || ch === "'") {
        var q = scanQuoted(src, i, ch, false);
        emit(q.text);
        i = q.end;
        lastWord = "";
        continue;
      }
      if (ch === "`") {
        // Template literals can contain `${}` holes with their own types inside
        // (`${x as number}`), so the hole is stripped recursively.
        var tstart = i;
        i++;
        var buf = "`";
        while (i < n) {
          if (src[i] === "\\") {
            buf += src.slice(i, i + 2);
            i += 2;
            continue;
          }
          if (src[i] === "$" && src[i + 1] === "{") {
            var hend = matchBrace(src, i + 1);
            buf += "${" + stripTypes(src.slice(i + 2, Math.max(i + 2, hend - 1))) + "}";
            i = hend;
            continue;
          }
          if (src[i] === "`") {
            buf += "`";
            i++;
            break;
          }
          buf += src[i];
          i++;
        }
        emit(buf);
        lastWord = "";
        continue;
      }
      // A regex literal, told from division by what precedes it.
      if (ch === "/" && /^(|[=(,:;!&|?{}[+\-*%~^<>]|return|typeof|case|in|of|do|else)$/.test(lastWord || lastSig)) {
        var r = i + 1;
        var inClass = false;
        var ok = false;
        while (r < n) {
          var rc = src[r];
          if (rc === "\\") {
            r += 2;
            continue;
          }
          if (rc === "\n") break;
          if (inClass) {
            if (rc === "]") inClass = false;
          } else if (rc === "[") inClass = true;
          else if (rc === "/") {
            r++;
            while (r < n && /[a-z]/.test(src[r])) r++;
            ok = true;
            break;
          }
          r++;
        }
        if (ok) {
          emit(src.slice(i, r));
          i = r;
          lastWord = "";
          continue;
        }
      }

      // Words: the keyword-driven removals all live here.
      if (isIdentStart(ch)) {
        var w = i;
        while (w < n && isIdentPart(src[w])) w++;
        var word = src.slice(i, w);
        var rest = skipSpace(src, w);
        var statementStart = atStatementStart();

        // `enum` needs generated runtime code, which is out of scope. Bail so the
        // run goes to the server, which has a real compiler.
        if (word === "enum" && statementStart) throw new Error("enum needs a real compiler");
        if (word === "declare" && statementStart) throw new Error("declare needs a real compiler");

        // `interface Foo { … }` — the whole block goes.
        if (word === "interface" && statementStart) {
          var braceAt = src.indexOf("{", w);
          if (braceAt < 0) throw new Error("unterminated interface");
          var iend = matchPair(src, braceAt);
          i = iend < 0 ? n : iend;
          lastSig = ";";
          lastWord = "";
          continue;
        }

        // `type Foo = …` — to the end of the initialiser.
        if (word === "type" && statementStart && isIdentStart(src.charAt(rest) || "")) {
          var eq = src.indexOf("=", rest);
          if (eq < 0) throw new Error("unterminated type alias");
          var tend = scanType(src, eq + 1);
          while (tend < n && /[ \t]/.test(src[tend])) tend++;
          if (src[tend] === ";") tend++;
          i = tend;
          lastSig = ";";
          lastWord = "";
          continue;
        }

        // `import type … ` / `export type { … }` are erased entirely.
        if ((word === "import" || word === "export") && statementStart && /^type\b/.test(src.slice(rest))) {
          var semi = src.indexOf(";", rest);
          var nl = src.indexOf("\n", rest);
          var cut = semi < 0 ? (nl < 0 ? n : nl) : semi + 1;
          if (nl >= 0 && nl < cut && src.slice(rest, nl).indexOf("{") < 0) cut = nl;
          i = cut;
          lastSig = ";";
          lastWord = "";
          continue;
        }

        // Access modifiers and `abstract`/`override` have no runtime meaning —
        // except on constructor parameters, where TypeScript uses them to
        // generate assignments. Bail on that one case rather than silently
        // producing a class whose fields are never set.
        if (/^(public|private|protected|readonly|override|abstract)$/.test(word) && isIdentStart(src.charAt(rest) || "")) {
          if (lastSig === "(" || lastSig === ",") {
            var ctorish = /constructor\s*\([^)]*$/.test(src.slice(Math.max(0, i - 400), i));
            if (ctorish) throw new Error("constructor parameter properties need a real compiler");
          }
          i = rest;
          continue;
        }

        // `implements A, B` before a class body.
        if (word === "implements") {
          var ib = src.indexOf("{", w);
          i = ib < 0 ? n : ib;
          continue;
        }

        // `as Foo` / `satisfies Foo` casts. Not gated on statement position:
        // `{ x: 1 } satisfies T` follows a `}`, which looks like one. The two
        // non-cast uses of `as` are import/export renames, which are the only
        // thing excluded here.
        if (word === "as" || word === "satisfies") {
          var renaming =
            lastSig === "*" || /\b(?:import|export)\b[^;\n]*$/.test(src.slice(Math.max(0, i - 200), i));
          if (!renaming) {
            if (/^const\b/.test(src.slice(rest))) {
              i = rest + 5; // `as const` — no type to consume
              continue;
            }
            i = scanType(src, rest);
            continue;
          }
        }

        emit(word);
        lastWord = word;
        i = w;

        // Generic parameter lists on declarations: function foo<T>(…),
        // class Box<T>, method<T>(…). Only after a declaration keyword or a
        // name that is immediately called, so `a < b` survives.
        if (src[i] === "<" && /^(function|class|interface|type)$/.test(lastWord) === false) {
          var declish = /(function|class|new)\s+[A-Za-z_$][\w$]*$/.test(src.slice(Math.max(0, i - 80), i));
          if (declish) {
            var gp = matchPair(src, i);
            if (gp > 0) {
              i = gp;
              continue;
            }
          }
        }
        if (/^(function|class)$/.test(word)) {
          var afterName = skipSpace(src, i);
          var nm = afterName;
          while (nm < n && isIdentPart(src[nm])) nm++;
          if (src[nm] === "<") {
            var gg = matchPair(src, nm);
            if (gg > 0) {
              emit(src.slice(i, nm));
              i = gg;
              continue;
            }
          }
        }
        continue;
      }

      // Braces: classify each `{` as object literal or block, because that is
      // what decides whether a `:` inside it is data or a type.
      if (ch === "{") {
        var isObj = /[=(,:[?]|=>|return|of|in|&&|\|\|/.test(lastSig + "") || lastSig === "=" || lastSig === "(" || lastSig === "," || lastSig === ":" || lastSig === "[" || lastSig === "?";
        braces.push(isObj ? "obj" : "block");
        emit("{");
        i++;
        lastWord = "";
        continue;
      }
      if (ch === "}") {
        braces.pop();
        emit("}");
        i++;
        lastWord = "";
        continue;
      }

      // `?` — ternary, optional chaining, nullish coalescing, or an optional
      // member marker. Only the last one is deleted.
      if (ch === "?") {
        if (src[i + 1] === "." || src[i + 1] === "?") {
          emit(src.slice(i, i + 2));
          i += 2;
          continue;
        }
        var after = skipSpace(src, i + 1);
        if (src[after] === ":" || src[after] === ")" || src[after] === "," || src[after] === ";" || src[after] === "=") {
          i++; // optional marker: `name?: T`, `arg?)`
          continue;
        }
        ternary++;
        emit("?");
        i++;
        continue;
      }

      // `!` — non-null assertion (drop) vs logical not / `!==` (keep). The
      // assertion is the only one that follows a value.
      if (ch === "!" && src[i + 1] !== "=") {
        if (/[\w$)\]"'`]/.test(lastSig)) {
          i++;
          continue;
        }
        emit("!");
        i++;
        continue;
      }

      if (ch === ":") {
        if (ternary > 0) {
          ternary--;
          emit(":");
          i++;
          continue;
        }
        var inObject = braces.length && braces[braces.length - 1] === "obj";
        // Inside an object literal a colon is a property separator; a label
        // (`outer:`) is rare enough that annotation-removal wins otherwise.
        if (inObject) {
          emit(":");
          i++;
          lastWord = "";
          continue;
        }
        var typeEnd = scanType(src, i + 1);
        if (typeEnd > i + 1) {
          i = typeEnd;
          lastWord = "";
          continue;
        }
        emit(":");
        i++;
        continue;
      }

      emit(ch);
      if (!/\s/.test(ch)) lastWord = "";
      i++;
    }

    return out.join("");
  }

  // ── The test harness ───────────────────────────────────────────────────
  //
  // This function is never called here. Its SOURCE is extracted with
  // Function.prototype.toString and prepended to the learner's code inside a
  // Web Worker, which is why it is written as a plain function instead of a
  // string: real syntax, real editing, real `node --check` coverage. (It also
  // means this file must never be minified — there is no build step, so it
  // won't be.)
  //
  // Everything it prints goes out as one line per event, in the same protocol
  // the server harness uses:  DOJO_TEST \t status \t name \t message
  function DOJO_HARNESS() {
    var __dojoTests = [];
    var __dojoStack = [];

    function __dojoEsc(s) {
      return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
    }

    function __dojoLine(text) {
      self.postMessage({ t: "line", v: String(text) });
    }

    function __dojoResult(status, name, message) {
      __dojoLine("DOJO_TEST\t" + status + "\t" + __dojoEsc(name) + "\t" + __dojoEsc(message || ""));
    }

    // console inside the worker becomes plain stdout, because `console.log`
    // while you debug is a first-class part of solving the thing.
    function __dojoFormat(v, depth) {
      depth = depth || 0;
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      var t = typeof v;
      if (t === "string") return depth === 0 ? v : JSON.stringify(v);
      if (t === "number" || t === "boolean" || t === "bigint") return String(v);
      if (t === "function") return "[Function " + (v.name || "anonymous") + "]";
      if (t === "symbol") return v.toString();
      if (v instanceof Error) return v.name + ": " + v.message;
      if (v instanceof Date) return v.toISOString();
      if (v instanceof RegExp) return String(v);
      if (depth > 4) return "…";
      if (v instanceof Map) {
        var mparts = [];
        v.forEach(function (val, key) {
          mparts.push(__dojoFormat(key, depth + 1) + " => " + __dojoFormat(val, depth + 1));
        });
        return "Map(" + v.size + ") {" + mparts.join(", ") + "}";
      }
      if (v instanceof Set) {
        var sparts = [];
        v.forEach(function (val) {
          sparts.push(__dojoFormat(val, depth + 1));
        });
        return "Set(" + v.size + ") {" + sparts.join(", ") + "}";
      }
      if (Array.isArray(v)) {
        var aparts = [];
        for (var i = 0; i < v.length && i < 100; i++) aparts.push(__dojoFormat(v[i], depth + 1));
        if (v.length > 100) aparts.push("… " + (v.length - 100) + " more");
        return "[" + aparts.join(", ") + "]";
      }
      try {
        var keys = Object.keys(v);
        var oparts = [];
        for (var k = 0; k < keys.length && k < 60; k++) {
          oparts.push(keys[k] + ": " + __dojoFormat(v[keys[k]], depth + 1));
        }
        var tag = v.constructor && v.constructor.name && v.constructor.name !== "Object" ? v.constructor.name + " " : "";
        return tag + "{" + oparts.join(", ") + "}";
      } catch (e) {
        return String(v);
      }
    }

    function __dojoJoin(args) {
      var parts = [];
      for (var i = 0; i < args.length; i++) parts.push(__dojoFormat(args[i], 0));
      return parts.join(" ");
    }

    var __dojoConsole = {
      log: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      info: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      debug: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      warn: function () {
        __dojoLine("warn: " + __dojoJoin(arguments));
      },
      error: function () {
        __dojoLine("error: " + __dojoJoin(arguments));
      },
      table: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      trace: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      group: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      groupEnd: function () {},
      dir: function () {
        __dojoLine(__dojoJoin(arguments));
      },
      time: function () {},
      timeEnd: function () {},
      assert: function () {},
      count: function () {},
    };

    // Some engines guard the global console; if the plain assignment is refused,
    // define over it. If even that fails, the run still works — the learner just
    // doesn't see their own logs, which beats crashing before the first test.
    try {
      self.console = __dojoConsole;
    } catch (e) {
      try {
        Object.defineProperty(self, "console", { value: __dojoConsole, configurable: true });
      } catch (e2) {
        /* nothing further to try */
      }
    }

    // ── equality ──
    // Arrays are order-sensitive (order is usually the thing under test); plain
    // objects are key-order-insensitive (insertion order almost never is).
    function __dojoEqual(a, b, seen) {
      if (Object.is(a, b)) return true;
      if (typeof a === "number" && typeof b === "number") {
        return Number.isNaN(a) && Number.isNaN(b);
      }
      if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
      seen = seen || [];
      for (var s = 0; s < seen.length; s++) {
        if (seen[s][0] === a && seen[s][1] === b) return true; // cycle: assume equal
      }
      seen.push([a, b]);

      if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
      }
      if (a instanceof RegExp || b instanceof RegExp) return String(a) === String(b);
      if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (!__dojoEqual(a[i], b[i], seen)) return false;
        return true;
      }
      if (a instanceof Map || b instanceof Map) {
        if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
        var mok = true;
        a.forEach(function (val, key) {
          if (!mok) return;
          if (!b.has(key)) {
            // Non-primitive keys need a scan, since Map lookup is by identity.
            var found = false;
            b.forEach(function (bval, bkey) {
              if (!found && __dojoEqual(key, bkey, seen) && __dojoEqual(val, bval, seen)) found = true;
            });
            if (!found) mok = false;
            return;
          }
          if (!__dojoEqual(val, b.get(key), seen)) mok = false;
        });
        return mok;
      }
      if (a instanceof Set || b instanceof Set) {
        if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
        var sok = true;
        a.forEach(function (val) {
          if (!sok || b.has(val)) return;
          var hit = false;
          b.forEach(function (bval) {
            if (!hit && __dojoEqual(val, bval, seen)) hit = true;
          });
          if (!hit) sok = false;
        });
        return sok;
      }
      if (a instanceof Error || b instanceof Error) {
        return a instanceof Error && b instanceof Error && a.name === b.name && a.message === b.message;
      }
      var ka = Object.keys(a);
      var kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) {
        if (!Object.prototype.hasOwnProperty.call(b, ka[j])) return false;
        if (!__dojoEqual(a[ka[j]], b[ka[j]], seen)) return false;
      }
      return true;
    }

    function __dojoFail(message) {
      var err = new Error(message);
      err.__dojoAssertion = true;
      throw err;
    }

    function __dojoMatchers(actual, negated) {
      var m = {};

      // Every matcher funnels through here: compute whether it passed, then
      // throw if that disagrees with whether we were negated.
      function check(pass, describe) {
        if (pass !== !negated) {
          __dojoFail(
            "expected " + __dojoFormat(actual, 1) + (negated ? " not " : " ") + describe
          );
        }
      }

      m.toBe = function (expected) {
        check(Object.is(actual, expected), "to be " + __dojoFormat(expected, 1));
      };
      m.toEqual = function (expected) {
        check(__dojoEqual(actual, expected), "to equal " + __dojoFormat(expected, 1));
      };
      m.toBeCloseTo = function (expected, digits) {
        var d = digits === undefined ? 6 : digits;
        var near =
          typeof actual === "number" &&
          typeof expected === "number" &&
          Math.abs(actual - expected) < Math.pow(10, -d) / 2;
        check(near, "to be close to " + expected + " (" + d + " digits)");
      };
      m.toContain = function (expected) {
        var has = false;
        if (typeof actual === "string") has = actual.indexOf(String(expected)) >= 0;
        else if (Array.isArray(actual)) {
          for (var i = 0; i < actual.length; i++) {
            if (Object.is(actual[i], expected) || __dojoEqual(actual[i], expected)) {
              has = true;
              break;
            }
          }
        } else if (actual instanceof Set || actual instanceof Map) has = actual.has(expected);
        else if (actual && typeof actual.includes === "function") has = actual.includes(expected);
        check(has, "to contain " + __dojoFormat(expected, 1));
      };
      m.toMatch = function (re) {
        // Duck-typed rather than `instanceof RegExp`, which is false for a regex
        // that crossed a realm boundary — and quietly turns into a search for
        // the literal text "/ell/" if you let it.
        var rx = re && typeof re.test === "function" ? re : new RegExp(String(re));
        check(rx.test(String(actual)), "to match " + String(rx));
      };
      m.toThrow = function (matcher) {
        if (typeof actual !== "function") __dojoFail("expect(…).toThrow needs a function to call");
        var threw = false;
        var caught = null;
        try {
          actual();
        } catch (e) {
          threw = true;
          caught = e;
        }
        if (!threw) {
          check(false, "to throw" + (matcher ? " " + String(matcher) : ""));
          return;
        }
        var message = caught && caught.message !== undefined ? String(caught.message) : String(caught);
        var matched = true;
        if (matcher && typeof matcher.test === "function") matched = matcher.test(message);
        else if (typeof matcher === "string") matched = message.indexOf(matcher) >= 0;
        if (negated) {
          if (matcher === undefined) __dojoFail("expected not to throw, but it threw: " + message);
          if (matched) __dojoFail("expected not to throw " + String(matcher) + ", but it did: " + message);
          return;
        }
        if (!matched) __dojoFail("expected to throw " + String(matcher) + ", but threw: " + message);
      };
      // Small conveniences the authoring agent will reach for anyway.
      m.toBeTruthy = function () {
        check(!!actual, "to be truthy");
      };
      m.toBeFalsy = function () {
        check(!actual, "to be falsy");
      };
      m.toBeNull = function () {
        check(actual === null, "to be null");
      };
      m.toBeUndefined = function () {
        check(actual === undefined, "to be undefined");
      };
      m.toBeDefined = function () {
        check(actual !== undefined, "to be defined");
      };
      m.toHaveLength = function (len) {
        check(actual != null && actual.length === len, "to have length " + len);
      };
      m.toBeGreaterThan = function (nn) {
        check(actual > nn, "to be greater than " + nn);
      };
      m.toBeLessThan = function (nn) {
        check(actual < nn, "to be less than " + nn);
      };
      m.toBeInstanceOf = function (ctor) {
        check(actual instanceof ctor, "to be an instance of " + (ctor && ctor.name));
      };

      if (!negated) m.not = __dojoMatchers(actual, true);
      return m;
    }

    self.expect = function (actual) {
      return __dojoMatchers(actual, false);
    };

    self.assert = function (cond, msg) {
      if (!cond) __dojoFail(msg || "assertion failed");
    };

    // Registration only. Nothing runs until the learner's code and the test file
    // have both finished evaluating, so a test may reference anything either one
    // defined, in any order.
    self.test = function (name, fn) {
      __dojoTests.push({ name: String(name), fn: fn });
    };
    self.it = self.test;
    self.describe = function (name, fn) {
      // Flattened: the prefix rides along in the test name, which is all the
      // results panel needs.
      var mark = __dojoTests.length;
      if (typeof fn === "function") fn();
      for (var i = mark; i < __dojoTests.length; i++) {
        __dojoTests[i].name = String(name) + " › " + __dojoTests[i].name;
      }
    };

    self.__dojoTopLevelError = function (e) {
      var name = e && e.name ? e.name : "Error";
      var message = e && e.message ? e.message : String(e);
      __dojoResult("error", name, message + __dojoHint(e));
      __dojoStack.push("fatal");
    };

    // One line of "where", translated back into the learner's own line numbers:
    // the harness sits above their code in the worker script, so raw stack line
    // numbers would point tens of lines past the end of what they can see.
    function __dojoHint(e) {
      if (!e || !e.stack) return "";
      var lines = String(e.stack).split("\n");
      for (var i = 0; i < lines.length; i++) {
        var m = /:(\d+):(\d+)\)?\s*$/.exec(lines[i]);
        if (!m) continue;
        var line = parseInt(m[1], 10) - __DOJO_LINE_OFFSET__;
        if (line > 0) return " (line " + line + ")";
      }
      return "";
    }

    self.__dojoRunAll = function () {
      if (__dojoStack.indexOf("fatal") >= 0) {
        self.postMessage({ t: "done" });
        return;
      }
      var i = 0;
      function next() {
        if (i >= __dojoTests.length) {
          if (__dojoTests.length === 0) {
            __dojoResult("error", "no tests", "the test block registered no tests");
          }
          self.postMessage({ t: "done" });
          return;
        }
        var entry = __dojoTests[i++];
        var settled = false;
        function finish(status, message) {
          if (settled) return;
          settled = true;
          __dojoResult(status, entry.name, message);
          next();
        }
        try {
          var result = entry.fn();
          // Async tests are awaited; the 4s wall clock upstairs is what stops a
          // promise that never settles.
          if (result && typeof result.then === "function") {
            result.then(
              function () {
                finish("pass", "");
              },
              function (e) {
                finish("fail", (e && e.message ? e.message : String(e)) + __dojoHint(e));
              }
            );
            return;
          }
          finish("pass", "");
        } catch (e) {
          var status = e && e.__dojoAssertion ? "fail" : "error";
          finish(status, (e && e.message ? e.message : String(e)) + __dojoHint(e));
        }
      }
      next();
    };
  }

  // ── The protocol ───────────────────────────────────────────────────────
  //
  // One format, two producers. The browser harness above and whatever the server
  // runs for python/rust/go both print, to stdout:
  //
  //   DOJO_TEST \t <pass|fail|error> \t <name> \t <message>
  //
  // with tabs and newlines inside the name and message escaped as the literal
  // two-character sequences \t and \n. Everything else on stdout is the
  // learner's own program output. Parsing both paths through this one function
  // is what makes a Rust run and a JS run render identically.

  function unescapeField(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "\\" && i + 1 < s.length) {
        var c = s[i + 1];
        if (c === "n") {
          out += "\n";
          i++;
          continue;
        }
        if (c === "t") {
          out += "\t";
          i++;
          continue;
        }
        if (c === "\\") {
          out += "\\";
          i++;
          continue;
        }
      }
      out += s[i];
    }
    return out;
  }

  function parseProtocol(lines) {
    var tests = [];
    var stdout = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.slice(0, 10) === "DOJO_TEST\t") {
        var parts = line.split("\t");
        var status = parts[1] === "pass" || parts[1] === "fail" || parts[1] === "error" ? parts[1] : "error";
        var name = unescapeField(parts[2] || "test");
        // Anything after the third tab belongs to the message: a harness that
        // forgot to escape a tab should still produce a readable result rather
        // than a truncated one.
        var message = unescapeField(parts.slice(3).join("\t"));
        tests.push({ name: name, status: status, message: message });
        continue;
      }
      stdout.push(line);
    }
    // Trailing blank lines are an artefact of line splitting, not output.
    while (stdout.length && !stdout[stdout.length - 1]) stdout.pop();
    return { tests: tests, stdout: stdout.join("\n") };
  }

  function tallyOutcome(base) {
    var tests = base.tests || [];
    var passed = 0;
    for (var i = 0; i < tests.length; i++) if (tests[i].status === "pass") passed++;
    var hardError = false;
    for (var j = 0; j < tests.length; j++) if (tests[j].status === "error") hardError = true;
    return {
      ok: base.ok !== undefined ? base.ok : !hardError,
      green: tests.length > 0 && passed === tests.length,
      passed: passed,
      total: tests.length,
      tests: tests,
      stdout: base.stdout || "",
      stderr: base.stderr || "",
      ms: base.ms || 0,
      where: base.where || "browser",
      note: base.note,
    };
  }

  // ── Browser path (js / ts) ─────────────────────────────────────────────

  // The harness source, sliced out of the function body once.
  var harnessCache = null;
  function harnessSource() {
    if (harnessCache !== null) return harnessCache;
    var text = String(DOJO_HARNESS);
    var open = text.indexOf("{");
    var close = text.lastIndexOf("}");
    harnessCache = open < 0 || close < 0 ? "" : text.slice(open + 1, close);
    return harnessCache;
  }

  // harness … then the learner's code and the test code inside ONE try block, so
  // that a `const` declared in the former is visible to the latter, and a
  // top-level throw in either becomes a single reported error instead of a dead
  // worker. __dojoRunAll() runs afterwards, once everything is registered.
  function buildWorkerSource(code, tests) {
    var prefix = "var __DOJO_LINE_OFFSET__=0;\n" + harnessSource() + "\ntry {\n";
    var offset = countLines(prefix) - 1;
    prefix = prefix.replace("var __DOJO_LINE_OFFSET__=0;", "var __DOJO_LINE_OFFSET__=" + offset + ";");
    return (
      prefix +
      code +
      "\n;\n" +
      tests +
      "\n} catch (__dojoErr) { __dojoTopLevelError(__dojoErr); }\n" +
      "__dojoRunAll();\n"
    );
  }

  // A Worker, not an iframe and not eval: user code gets no document, no
  // localStorage of ours, no way to rewrite the doc it is embedded in — and it
  // can be killed mid-infinite-loop, which eval cannot.
  function runInWorker(code, tests) {
    return new Promise(function (resolve) {
      var started = now();
      var lines = [];
      var url = null;
      var worker = null;
      var timer = null;
      var settled = false;

      function cleanup() {
        if (timer) clearTimeout(timer);
        timer = null;
        try {
          if (worker) worker.terminate();
        } catch (e) {
          /* already gone */
        }
        try {
          if (url) URL.revokeObjectURL(url);
        } catch (e) {
          /* already revoked */
        }
        worker = null;
        url = null;
      }

      function finish(extra) {
        if (settled) return;
        settled = true;
        var parsed = parseProtocol(lines);
        cleanup();
        var base = {
          tests: parsed.tests.concat(extra && extra.tests ? extra.tests : []),
          stdout: parsed.stdout,
          stderr: (extra && extra.stderr) || "",
          ms: Math.round(now() - started),
          where: "browser",
          ok: extra && extra.ok !== undefined ? extra.ok : true,
        };
        if (extra && extra.syntaxError) base.syntaxError = true;
        var outcome = tallyOutcome(base);
        if (extra && extra.syntaxError) outcome.syntaxError = true;
        resolve(outcome);
      }

      try {
        var blob = new Blob([buildWorkerSource(code, tests)], { type: "text/javascript" });
        url = URL.createObjectURL(blob);
        worker = new Worker(url);
      } catch (e) {
        cleanup();
        resolve({ workerUnavailable: true, reason: e && e.message ? e.message : String(e) });
        return;
      }

      worker.onmessage = function (event) {
        var data = event.data || {};
        if (data.t === "line") lines.push(String(data.v));
        else if (data.t === "done") finish({});
      };

      // A worker `error` event before any result is almost always a parse
      // failure — which for TypeScript means the stripper produced something the
      // engine wouldn't take, and the caller should retry on the server.
      worker.onerror = function (event) {
        try {
          event.preventDefault();
        } catch (e) {
          /* not preventable everywhere */
        }
        var message = (event && (event.message || event.error)) || "the worker crashed";
        var text = String(message);
        var isSyntax = /SyntaxError|Unexpected|Invalid or unexpected token/i.test(text);
        finish({
          ok: false,
          syntaxError: isSyntax,
          stderr: text.replace(/^Uncaught\s*/, ""),
          tests: lines.length
            ? []
            : [{ name: isSyntax ? "SyntaxError" : "crash", status: "error", message: text }],
        });
      };

      // 4 seconds, enforced from out here because a runaway loop inside the
      // worker can never enforce it on itself. An infinite loop is an ordinary
      // mistake while learning, so it gets a real result, not a hung page.
      timer = setTimeout(function () {
        if (settled) return;
        finish({
          ok: false,
          tests: [
            {
              name: "timeout",
              status: "error",
              message: "stopped after " + RUN_TIMEOUT_MS / 1000 + "s — an infinite loop, or something waiting on a promise that never settles",
            },
          ],
        });
      }, RUN_TIMEOUT_MS);
    });
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  // ── Server path (python / rust / go, and the TS fallback) ──────────────

  function runOnServer(payload) {
    var started = now();
    return fetch("/api/dojo/run", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(
            function (body) {
              return serverFailure(res.status, body, started);
            },
            function () {
              return serverFailure(res.status, "", started);
            }
          );
        }
        return res.json().then(function (data) {
          // Trust the server's parsed tests when it sent any; otherwise run its
          // stdout through the same parser the browser path uses.
          var raw = typeof data.stdout === "string" ? data.stdout : "";
          var parsed = parseProtocol(raw ? raw.split(/\r?\n/) : []);
          var tests = Array.isArray(data.tests) && data.tests.length ? data.tests : parsed.tests;
          return tallyOutcome({
            ok: data.ok !== undefined ? data.ok : true,
            tests: tests,
            stdout: parsed.stdout,
            stderr: typeof data.stderr === "string" ? data.stderr : "",
            ms: typeof data.ms === "number" ? data.ms : Math.round(now() - started),
            where: data.where === "browser" ? "browser" : "sandbox",
            note: data.note,
          });
        });
      })
      .catch(function (e) {
        // Offline, blocked, aborted — anything. A readable result, never a
        // rejected promise escaping into the page.
        return tallyOutcome({
          ok: false,
          tests: [
            {
              name: "runner unreachable",
              status: "error",
              message: "could not reach the server runner" + (e && e.message ? " (" + e.message + ")" : ""),
            },
          ],
          stderr: "",
          ms: Math.round(now() - started),
          where: "sandbox",
        });
      });
  }

  function serverFailure(status, body, started) {
    var message =
      status === 404
        ? "the server runner isn't available on this deployment yet"
        : "the server runner returned " + status;
    // A proxy or platform error page is HTML, and dumping a stylesheet into the
    // errors block tells the learner nothing. Only pass along a plain-text body.
    var detail = /^\s*</.test(body || "") ? "" : (body || "").slice(0, 800);
    return tallyOutcome({
      ok: false,
      tests: [{ name: "runner error", status: "error", message: message }],
      stderr: detail,
      ms: Math.round(now() - started),
      where: "sandbox",
    });
  }

  // ── The one entry point the UI calls ──────────────────────────────────

  // Decides browser vs server, does the TypeScript dance, and always resolves
  // with a RunOutcome. Never rejects.
  function runChallenge(ctx) {
    var lang = ctx.lang;
    var code = ctx.code;
    var tests = ctx.tests;

    // The worker is a classic script, so `export` is a syntax error in it — and
    // authored starter code very reasonably says `export function foo`. Dropping
    // the keyword at line starts costs nothing (the whole file shares one scope
    // in the worker) and saves an otherwise baffling failure. Line-anchored so
    // the word `export` inside a string or comment is left alone.
    function stripModuleSyntax(text) {
      return String(text || "")
        .replace(/^([ \t]*)export[ \t]+default[ \t]+/gm, "$1")
        .replace(/^([ \t]*)export[ \t]+(?=(?:const|let|var|function|class|async|abstract|interface|type|enum)\b)/gm, "$1")
        .replace(/^[ \t]*export[ \t]*\{[^}]*\}[ \t]*;?[ \t]*$/gm, "");
    }

    function serverRun(note) {
      return runOnServer({
        slug: ctx.slug,
        challengeId: ctx.challengeId,
        lang: lang,
        code: code,
        tests: tests,
      }).then(function (outcome) {
        if (note && !outcome.note) outcome.note = note;
        return outcome;
      });
    }

    if (!BROWSER_LANGS[lang]) return serverRun();

    var jsCode = stripModuleSyntax(code);
    var jsTests = stripModuleSyntax(tests);
    if (lang === "ts") {
      try {
        jsCode = stripTypes(jsCode);
        jsTests = stripTypes(jsTests);
      } catch (e) {
        // The stripper met something it can't handle honestly (an enum, a
        // constructor parameter property). Hand it to a real compiler rather
        // than showing the learner a failure that is ours, not theirs.
        return serverRun("ran on the server — the browser couldn't parse the types");
      }
    }

    return runInWorker(jsCode, jsTests).then(function (outcome) {
      if (outcome && outcome.workerUnavailable) {
        return serverRun("ran on the server — this page can't start a worker");
      }
      if (outcome && outcome.syntaxError && lang === "ts") {
        return serverRun("ran on the server — the browser couldn't parse the types");
      }
      return outcome;
    });
  }

  // ── The editor ─────────────────────────────────────────────────────────
  //
  // A transparent <textarea> layered exactly over a highlighted <pre>. The
  // browser does selection, caret, IME, spellcheck-off, undo and accessibility;
  // we do color. The whole trick lives or dies on the two layers agreeing about
  // metrics — font, size, line-height, padding, letter-spacing, tab-size — which
  // is why all of those live in ONE css rule shared by .dojo-pre and .dojo-ta
  // rather than being set twice.

  var INDENT = "  "; // two spaces, everywhere, in every language
  var OPENERS = { "(": ")", "[": "]", "{": "}" };
  var QUOTES = { '"': 1, "'": 1, "`": 1 };

  function lineStartOf(text, pos) {
    var at = text.lastIndexOf("\n", pos - 1);
    return at < 0 ? 0 : at + 1;
  }

  function lineEndOf(text, pos) {
    var at = text.indexOf("\n", pos);
    return at < 0 ? text.length : at;
  }

  function leadingWhitespace(line) {
    return /^[ \t]*/.exec(line)[0];
  }

  function buildEditor(lang, initial, hooks) {
    var editor = el("div", "dojo-editor");
    var gutter = el("div", "dojo-gutter");
    gutter.setAttribute("aria-hidden", "true");
    var wrap = el("div", "dojo-codewrap");
    var pre = el("pre", "dojo-pre");
    pre.setAttribute("aria-hidden", "true"); // the textarea is the real content
    var codeEl = el("code");
    pre.appendChild(codeEl);

    var ta = el("textarea", "dojo-ta");
    ta.spellcheck = false;
    ta.setAttribute("spellcheck", "false");
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("wrap", "off");
    ta.setAttribute("aria-label", "Your solution (" + (LANG_LABEL[lang] || lang) + ")");
    ta.value = initial;

    wrap.appendChild(pre);
    wrap.appendChild(ta);
    editor.appendChild(gutter);
    editor.appendChild(wrap);

    var metrics = null;

    // Measured from the live element rather than assumed, because the doc's
    // --dojo-font-mono decides the real line box and every template picks a
    // different one.
    function readMetrics() {
      var cs = window.getComputedStyle(ta);
      var lh = parseFloat(cs.lineHeight);
      if (!isFinite(lh) || lh <= 0) lh = parseFloat(cs.fontSize) * 1.55 || 20;
      metrics = {
        lineHeight: lh,
        padTop: parseFloat(cs.paddingTop) || 0,
        padBottom: parseFloat(cs.paddingBottom) || 0,
      };
      return metrics;
    }

    var lastLineCount = -1;

    function renderGutter(count) {
      if (count === lastLineCount) return;
      lastLineCount = count;
      var rows = [];
      for (var i = 1; i <= count; i++) rows.push(i);
      gutter.textContent = rows.join("\n");
      // Widen with the number of digits so a 100-line file doesn't clip.
      gutter.style.minWidth = String(count).length + "ch";
    }

    // Grow to fit, up to MAX_LINES, then scroll internally: a challenge should
    // never make the reader scroll the whole document to see its own code, and
    // should never turn into an endless page either.
    function resize() {
      var m = metrics || readMetrics();
      var count = countLines(ta.value);
      var shown = Math.min(MAX_LINES, Math.max(MIN_LINES, count));
      editor.style.height = Math.ceil(shown * m.lineHeight + m.padTop + m.padBottom) + "px";
      renderGutter(count);
    }

    // The textarea is the only element that really scrolls (it owns the caret),
    // so the highlighted layer and the gutter are pushed to match it. Without
    // this the colors slide off the characters the moment a line runs long.
    function syncScroll() {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    }

    function render() {
      // The trailing newline keeps the final line's box alive so the caret on an
      // empty last line has something to sit against.
      codeEl.innerHTML = highlight(ta.value, lang) + "\n";
    }

    function refresh() {
      render();
      resize();
      syncScroll();
    }

    var api = {
      root: editor,
      textarea: ta,
      get: function () {
        return ta.value;
      },
      set: function (value) {
        ta.value = value;
        refresh();
      },
      focus: function () {
        ta.focus();
      },
      refresh: refresh,
      remeasure: function () {
        metrics = null;
        refresh();
      },
    };

    // Mutate through execCommand where it exists: it is the only way to change a
    // textarea's value that keeps the browser's native undo stack intact. Losing
    // Cmd+Z in a code editor is not a small papercut, so the direct-assignment
    // path is strictly a fallback.
    function replaceRange(start, end, text, selStart, selEnd) {
      ta.focus();
      ta.setSelectionRange(start, end);
      var ok = false;
      try {
        ok = !!(document.execCommand && document.execCommand("insertText", false, text));
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        var v = ta.value;
        ta.value = v.slice(0, start) + text + v.slice(end);
      }
      var s = selStart == null ? start + text.length : selStart;
      ta.setSelectionRange(s, selEnd == null ? s : selEnd);
      refresh();
      if (hooks.onChange) hooks.onChange();
    }

    ta.addEventListener("input", function () {
      refresh();
      if (hooks.onChange) hooks.onChange();
    });
    ta.addEventListener("scroll", syncScroll);
    // A resize can change the wrap width and therefore the scroll geometry.
    if (window.ResizeObserver) {
      try {
        new ResizeObserver(syncScroll).observe(wrap);
      } catch (e) {
        /* not fatal */
      }
    }

    ta.addEventListener("keydown", function (event) {
      var mod = event.metaKey || event.ctrlKey;
      var value = ta.value;
      var start = ta.selectionStart;
      var end = ta.selectionEnd;

      if (mod && event.key === "Enter") {
        event.preventDefault();
        if (hooks.onRun) hooks.onRun();
        return;
      }
      if (mod && (event.key === "s" || event.key === "S")) {
        // The doc is a static file; there is nothing for the browser's Save
        // dialog to do here except confuse. Take the keystroke and checkpoint.
        event.preventDefault();
        if (hooks.onSave) hooks.onSave();
        return;
      }
      if (mod) return; // leave every other shortcut alone

      if (event.key === "Tab") {
        event.preventDefault();
        var multi = value.slice(start, end).indexOf("\n") >= 0;
        if (!multi && !event.shiftKey) {
          replaceRange(start, end, INDENT);
          return;
        }
        // Line-based: shift whole lines, and keep the selection over them.
        var blockStart = lineStartOf(value, start);
        var blockEnd = lineEndOf(value, end);
        var lines = value.slice(blockStart, blockEnd).split("\n");
        var firstDelta = 0;
        var totalDelta = 0;
        for (var i = 0; i < lines.length; i++) {
          if (event.shiftKey) {
            var lead = leadingWhitespace(lines[i]);
            var cut = lead.slice(0, INDENT.length).replace(/[^ \t]/g, "").length;
            if (lead.indexOf(INDENT) === 0) cut = INDENT.length;
            else if (lead.length > 0) cut = Math.min(lead.length, INDENT.length);
            else cut = 0;
            lines[i] = lines[i].slice(cut);
            if (i === 0) firstDelta = -cut;
            totalDelta -= cut;
          } else {
            if (lines[i] === "" && lines.length > 1 && i === lines.length - 1) continue;
            lines[i] = INDENT + lines[i];
            if (i === 0) firstDelta = INDENT.length;
            totalDelta += INDENT.length;
          }
        }
        var replacement = lines.join("\n");
        replaceRange(
          blockStart,
          blockEnd,
          replacement,
          Math.max(blockStart, start + firstDelta),
          Math.max(blockStart, end + totalDelta)
        );
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        var ls = lineStartOf(value, start);
        var currentLine = value.slice(ls, start);
        var indent = leadingWhitespace(currentLine);
        var trimmed = currentLine.replace(/\s+$/, "");
        var lastChar = trimmed.charAt(trimmed.length - 1);
        // Open a block after {, [, ( or a python/ts `:` — and after a `=>`.
        var opens = lastChar === "{" || lastChar === "[" || lastChar === "(" || lastChar === ":";
        var inner = indent + (opens ? INDENT : "");
        var nextChar = value.charAt(end);
        var closerFollows =
          (lastChar === "{" && nextChar === "}") ||
          (lastChar === "[" && nextChar === "]") ||
          (lastChar === "(" && nextChar === ")");
        if (closerFollows) {
          // Split the pair across three lines and land in the middle one.
          var text = "\n" + inner + "\n" + indent;
          replaceRange(start, end, text, start + 1 + inner.length);
          return;
        }
        replaceRange(start, end, "\n" + inner);
        return;
      }

      // Typing the closer on a blank line pulls that line back one level, so
      // `}` lands under the thing it closes without a manual backspace.
      if (event.key === "}" || event.key === "]" || event.key === ")") {
        var ls2 = lineStartOf(value, start);
        var head = value.slice(ls2, start);
        if (start === end && head.length && /^[ \t]+$/.test(head)) {
          event.preventDefault();
          var reduced = head.length >= INDENT.length ? head.slice(0, head.length - INDENT.length) : "";
          replaceRange(ls2, start, reduced + event.key);
          return;
        }
        // Type-over: the closer already sitting under the caret is almost always
        // the one we auto-inserted, so step past it instead of doubling it.
        if (start === end && value.charAt(start) === event.key) {
          event.preventDefault();
          ta.setSelectionRange(start + 1, start + 1);
          return;
        }
        return;
      }

      // Auto-close, conservatively: only when the caret is at the end of the
      // line or in front of whitespace or a closer, so it never gets in the way
      // of editing existing code.
      if (OPENERS[event.key] || QUOTES[event.key]) {
        var after = value.charAt(end);
        var before = value.charAt(start - 1);
        var quiet = after === "" || /[\s)\]},;]/.test(after);
        if (QUOTES[event.key]) {
          if (start === end && after === event.key) {
            event.preventDefault();
            ta.setSelectionRange(start + 1, start + 1);
            return;
          }
          // Don't turn "don't" into "don''t", and don't close inside a word.
          if (!quiet || /[A-Za-z0-9_$\\]/.test(before)) return;
          event.preventDefault();
          replaceRange(start, end, event.key + event.key, start + 1);
          return;
        }
        if (start !== end) {
          // Wrap the selection rather than replacing it.
          event.preventDefault();
          var selected = value.slice(start, end);
          replaceRange(start, end, event.key + selected + OPENERS[event.key], start + 1, end + 1);
          return;
        }
        if (!quiet) return;
        event.preventDefault();
        replaceRange(start, end, event.key + OPENERS[event.key], start + 1);
        return;
      }

      // Backspace between an empty pair removes both halves.
      if (event.key === "Backspace" && start === end && start > 0) {
        var prev = value.charAt(start - 1);
        var nxt = value.charAt(start);
        if ((OPENERS[prev] && nxt === OPENERS[prev]) || (QUOTES[prev] && nxt === prev)) {
          event.preventDefault();
          replaceRange(start - 1, start + 1, "");
          return;
        }
      }
    });

    // First paint happens after the element is in the document (metrics need
    // real computed styles), which the caller arranges by calling mount().
    api.mount = function () {
      readMetrics();
      refresh();
    };

    return api;
  }

  // Read-only highlighted code: the predict shape, and revealed solutions.
  function buildReadOnlyCode(lang, code, label) {
    var pre = el("pre", "dojo-readonly");
    var codeEl = el("code");
    codeEl.innerHTML = highlight(code, lang) + "\n";
    pre.appendChild(codeEl);
    pre.setAttribute("tabindex", "0"); // keyboard-scrollable
    pre.setAttribute("role", "group");
    pre.setAttribute("aria-label", label || "Code");
    return pre;
  }

  // ── Monaco: the optional upgrade ───────────────────────────────────────
  //
  // The textarea editor above is the one that always works: no download, no
  // dependency, correct on the first paint. But `.` should open completions and
  // a type error should be underlined where you made it, and that needs a real
  // language service. So Monaco is vendored to /dojo/vs and loaded LAZILY — not
  // on page load, but on the first genuine intent to edit — and then swapped in
  // underneath the same api the rest of this file already calls.
  //
  // Three consequences of "lazily", all deliberate:
  //   · a reader who never touches an editor downloads none of it;
  //   · the loader's AMD `define` appears on the page long after the document's
  //     own scripts have run, so it can't hijack a UMD bundle a template inlined;
  //   · if any of it fails — offline, 404, blocked worker — nothing happens. The
  //     textarea stays. A dojo must never become unusable because an editor
  //     didn't download.
  //
  // Version note: Monaco is pinned at 0.52.2 because 0.54 removed the
  // self-contained AMD worker bootstrap this setup depends on.

  var MONACO_BASE = "/dojo/vs";
  var MONACO_WORKER_URL = "/dojo/worker-bootstrap.js";
  var MONACO_LOAD_TIMEOUT_MS = 20000;
  var MONACO_THEME = "dojo";
  var MONACO_LIB_URI = "ts:dojo-harness.d.ts"; // stable: re-registering must not duplicate

  var monacoState = {
    promise: null, // in-flight or settled load
    monaco: null, // window.monaco once ready
    failed: false,
    editors: [], // live editor handles, for disposal and relayout
  };

  var MONACO_LANG_ID = { ts: "typescript", js: "javascript", python: "python", rust: "rust", go: "go" };
  var MONACO_EXT = { ts: "ts", js: "js", python: "py", rust: "rs", go: "go" };

  // ── colour plumbing ──
  //
  // Monaco's theme API wants concrete colours: `var(--dojo-accent)` means nothing
  // to it. So we resolve the custom properties off a real element and normalise
  // whatever the document wrote — hex, rgb(), a named colour, oklch() — into the
  // hex Monaco parses. A <canvas> does the normalising because it is the one
  // colour parser every browser already agrees on.

  var colorCanvas = null;
  function normalizeColor(value, fallback) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return fallback;
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{8}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return ("#" + text[1] + text[1] + text[2] + text[2] + text[3] + text[3]).toLowerCase();
    }
    try {
      if (!colorCanvas) colorCanvas = document.createElement("canvas");
      var ctx = colorCanvas.getContext("2d");
      if (!ctx) return fallback;
      // Set a known value first: an unparseable assignment is ignored rather than
      // throwing, so without this we'd silently inherit the previous colour.
      ctx.fillStyle = "#010203";
      ctx.fillStyle = text;
      var got = String(ctx.fillStyle);
      if (got === "#010203" && text.replace(/\s/g, "").toLowerCase() !== "#010203") return fallback;
      if (/^#[0-9a-f]{6}$/i.test(got)) return got.toLowerCase();
      var m = /^rgba?\(([^)]+)\)$/i.exec(got);
      if (m) {
        var parts = m[1].split(",");
        var r = parseFloat(parts[0]);
        var g = parseFloat(parts[1]);
        var b = parseFloat(parts[2]);
        var a = parts.length > 3 ? parseFloat(parts[3]) : 1;
        return rgbaToHex(r, g, b, a);
      }
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  function hex2(n) {
    var v = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return v.length === 1 ? "0" + v : v;
  }

  function rgbaToHex(r, g, b, a) {
    var base = "#" + hex2(r) + hex2(g) + hex2(b);
    if (a == null || a >= 1) return base;
    return base + hex2(a * 255);
  }

  function parseHex(color) {
    var text = String(color || "").replace("#", "");
    if (text.length === 3) text = text[0] + text[0] + text[1] + text[1] + text[2] + text[2];
    return {
      r: parseInt(text.slice(0, 2), 16) || 0,
      g: parseInt(text.slice(2, 4), 16) || 0,
      b: parseInt(text.slice(4, 6), 16) || 0,
      a: text.length >= 8 ? (parseInt(text.slice(6, 8), 16) || 0) / 255 : 1,
    };
  }

  // Monaco token rules take an opaque six-digit colour with no `#`, so a
  // translucent syntax colour has to be flattened onto the paper first.
  function tokenColor(color, over) {
    var c = parseHex(normalizeColor(color, "#000000"));
    if (c.a >= 1) return hex2(c.r) + hex2(c.g) + hex2(c.b);
    var bg = parseHex(normalizeColor(over, "#ffffff"));
    return (
      hex2(c.r * c.a + bg.r * (1 - c.a)) +
      hex2(c.g * c.a + bg.g * (1 - c.a)) +
      hex2(c.b * c.a + bg.b * (1 - c.a))
    );
  }

  // An alpha wash of a colour, for selections and hover rows.
  function withAlpha(color, alpha) {
    var c = parseHex(normalizeColor(color, "#000000"));
    return "#" + hex2(c.r) + hex2(c.g) + hex2(c.b) + hex2(alpha * 255);
  }

  // Perceived lightness of the doc's paper, which is what decides whether Monaco
  // should inherit `vs` or `vs-dark` — a dark template must not get a white box.
  function luminance(color) {
    var c = parseHex(normalizeColor(color, "#ffffff"));
    var f = function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  // Blend two colours, for deriving a value the document didn't give us.
  function mix(a, b, t) {
    var x = parseHex(normalizeColor(a, "#000000"));
    var y = parseHex(normalizeColor(b, "#ffffff"));
    return (
      "#" +
      hex2(x.r + (y.r - x.r) * t) +
      hex2(x.g + (y.g - x.g) * t) +
      hex2(x.b + (y.b - x.b) * t)
    );
  }

  // Read the whole palette off a live .dojo-challenge.
  //
  // Two deliberate choices here. First, we read the `--dojo-_*` aliases rather
  // than the public names, so the fallback chain declared in the stylesheet above
  // applies to Monaco too — the CSS stays the single source of truth for what a
  // doc gets when it doesn't specify something. Second, the second argument to
  // `v()` is only reachable if that stylesheet failed to load at all, so those
  // values derive from the three colours a page cannot really lack instead of
  // restating a palette that would then be free to drift out of sync.
  function readPalette(sample) {
    var cs = window.getComputedStyle(sample);
    function v(name, fallback) {
      return normalizeColor(cs.getPropertyValue(name), fallback);
    }
    var paper = v("--dojo-_paper", "#ffffff");
    var ink = v("--dojo-_ink", "#14161a");
    var accent = v("--dojo-_accent", "#2b4de0");
    var muted = v("--dojo-_muted", mix(ink, paper, 0.45));
    // Pass and fail are the only two that can't be derived: "this went well" is
    // green and "this didn't" is red, and no amount of mixing the page's own
    // colours produces that meaning. These mirror the stylesheet's fallbacks.
    var pass = v("--dojo-_pass", "#1a7f4b");
    var fail = v("--dojo-_fail", "#c02626");
    return {
      paper: paper,
      ink: ink,
      accent: accent,
      muted: muted,
      pass: pass,
      fail: fail,
      line: v("--dojo-_line", withAlpha(ink, 0.16)),
      codeBg: v("--dojo-_code-bg", withAlpha(ink, 0.04)),
      codeInk: v("--dojo-_code-ink", ink),
      syn: {
        keyword: v("--dojo-_syn-keyword", accent),
        string: v("--dojo-_syn-string", pass),
        comment: v("--dojo-_syn-comment", muted),
        number: v("--dojo-_syn-number", fail),
        fn: v("--dojo-_syn-fn", mix(accent, ink, 0.35)),
        type: v("--dojo-_syn-type", mix(accent, muted, 0.4)),
        punct: v("--dojo-_syn-punct", muted),
      },
    };
  }

  // The theme. Token rules cover all five languages at once: Monaco's Monarch
  // grammars for python/rust/go emit their own token names, so the mapping is
  // deliberately generous — an unused rule costs nothing, a missing one shows up
  // as default-blue text on a cream page.
  function defineMonacoTheme(monaco, sample) {
    var p = readPalette(sample);
    var flat = p.codeBg && parseHex(p.codeBg).a < 1 ? p.paper : p.codeBg;
    var t = function (color) {
      return tokenColor(color, flat);
    };
    var syn = p.syn;

    var rules = [
      { token: "", foreground: t(p.codeInk) },
      { token: "identifier", foreground: t(p.codeInk) },
      { token: "comment", foreground: t(syn.comment), fontStyle: "italic" },
      { token: "comment.doc", foreground: t(syn.comment), fontStyle: "italic" },
      { token: "string", foreground: t(syn.string) },
      { token: "string.escape", foreground: t(syn.string) },
      { token: "string.invalid", foreground: t(p.fail) },
      { token: "string.key", foreground: t(p.codeInk) },
      { token: "string.value", foreground: t(syn.string) },
      { token: "regexp", foreground: t(syn.string) },
      { token: "keyword", foreground: t(syn.keyword) },
      { token: "keyword.flow", foreground: t(syn.keyword) },
      { token: "keyword.json", foreground: t(syn.keyword) },
      { token: "constant", foreground: t(syn.number) },
      { token: "constant.language", foreground: t(syn.keyword) },
      { token: "number", foreground: t(syn.number) },
      { token: "number.hex", foreground: t(syn.number) },
      { token: "number.float", foreground: t(syn.number) },
      { token: "type", foreground: t(syn.type) },
      { token: "type.identifier", foreground: t(syn.type) },
      // Rust lexes i32/u8/bool as `keyword.type.rust`, which would otherwise
      // match the `keyword` rule above. Monaco resolves by longest dot-prefix,
      // so this more specific rule wins — and matches what the textarea
      // tokenizer does with the same words.
      { token: "keyword.type", foreground: t(syn.type) },
      { token: "namespace", foreground: t(syn.type) },
      { token: "predefined", foreground: t(syn.type) }, // python builtins, go types
      { token: "support.type", foreground: t(syn.type) },
      { token: "entity.name.type", foreground: t(syn.type) },
      { token: "function", foreground: t(syn.fn) },
      { token: "entity.name.function", foreground: t(syn.fn) },
      { token: "support.function", foreground: t(syn.fn) },
      { token: "meta.function-call", foreground: t(syn.fn) },
      { token: "annotation", foreground: t(syn.fn) }, // python decorators, rust attrs
      { token: "attribute.name", foreground: t(syn.fn) },
      // Python decorators come through as `tag.python`. Without this rule
      // `@property` renders unstyled, which is exactly the kind of small wrongness
      // that makes a themed editor look broken.
      { token: "tag", foreground: t(syn.fn) },
      { token: "variable.predefined", foreground: t(syn.fn) },
      { token: "variable.parameter", foreground: t(p.codeInk) },
      { token: "delimiter", foreground: t(syn.punct) },
      { token: "delimiter.bracket", foreground: t(syn.punct) },
      { token: "delimiter.parenthesis", foreground: t(syn.punct) },
      { token: "delimiter.square", foreground: t(syn.punct) },
      { token: "delimiter.curly", foreground: t(syn.punct) },
      { token: "operator", foreground: t(syn.punct) },
      { token: "invalid", foreground: t(p.fail) },
    ];

    // The widget colours matter as much as the editor's: a suggest popup left on
    // its defaults is a grey VS Code rectangle sitting on somebody's cream page,
    // and it reads as a bug.
    var colors = {
      "editor.background": p.codeBg,
      "editor.foreground": p.codeInk,
      "editorCursor.foreground": p.ink,
      "editorLineNumber.foreground": withAlpha(p.muted, 0.65),
      "editorLineNumber.activeForeground": p.ink,
      "editorGutter.background": "#00000000",
      "editor.selectionBackground": withAlpha(p.accent, 0.28),
      "editor.inactiveSelectionBackground": withAlpha(p.accent, 0.16),
      "editor.selectionHighlightBackground": withAlpha(p.accent, 0.12),
      "editor.wordHighlightBackground": withAlpha(p.accent, 0.1),
      "editor.wordHighlightStrongBackground": withAlpha(p.accent, 0.14),
      "editor.findMatchBackground": withAlpha(p.accent, 0.3),
      "editor.findMatchHighlightBackground": withAlpha(p.accent, 0.16),
      "editor.lineHighlightBackground": withAlpha(p.ink, 0.045),
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background": withAlpha(p.muted, 0.22),
      "editorIndentGuide.activeBackground": withAlpha(p.muted, 0.45),
      "editorWhitespace.foreground": withAlpha(p.muted, 0.35),
      "editorBracketMatch.background": withAlpha(p.accent, 0.16),
      "editorBracketMatch.border": p.accent,
      // Bracket-pair colourization is switched off in the editor options, but
      // theme these too so that nothing can reintroduce VS Code's rainbow.
      "editorBracketHighlight.foreground1": p.syn.punct,
      "editorBracketHighlight.foreground2": p.syn.punct,
      "editorBracketHighlight.foreground3": p.syn.punct,
      "editorBracketHighlight.foreground4": p.syn.punct,
      "editorBracketHighlight.foreground5": p.syn.punct,
      "editorBracketHighlight.foreground6": p.syn.punct,
      "editorBracketHighlight.unexpectedBracket.foreground": p.fail,
      "editorError.foreground": p.fail,
      "editorWarning.foreground": p.accent,
      "editorInfo.foreground": p.muted,
      "editorOverviewRuler.border": "#00000000",
      "editorOverviewRuler.errorForeground": p.fail,
      "editorOverviewRuler.warningForeground": p.accent,
      "editorWidget.background": p.paper,
      "editorWidget.foreground": p.ink,
      "editorWidget.border": p.line,
      "editorSuggestWidget.background": p.paper,
      "editorSuggestWidget.border": p.line,
      "editorSuggestWidget.foreground": p.ink,
      "editorSuggestWidget.selectedBackground": withAlpha(p.accent, 0.16),
      "editorSuggestWidget.selectedForeground": p.ink,
      "editorSuggestWidget.highlightForeground": p.accent,
      "editorSuggestWidget.focusHighlightForeground": p.accent,
      "editorSuggestWidgetStatus.foreground": p.muted,
      "editorHoverWidget.background": p.paper,
      "editorHoverWidget.foreground": p.ink,
      "editorHoverWidget.border": p.line,
      "editorHoverWidget.statusBarBackground": p.codeBg,
      "editorMarkerNavigationError.background": p.fail,
      "editorMarkerNavigationWarning.background": p.accent,
      "editorMarkerNavigation.background": p.paper,
      "editorLink.activeForeground": p.accent,
      "textLink.foreground": p.accent,
      "textCodeBlock.background": p.codeBg,
      "descriptionForeground": p.muted,
      "focusBorder": p.accent,
      "widget.shadow": withAlpha(p.ink, 0.14),
      "widget.border": p.line,
      "input.background": p.codeBg,
      "input.foreground": p.ink,
      "input.border": p.line,
      "inputOption.activeBorder": p.accent,
      "list.hoverBackground": withAlpha(p.accent, 0.1),
      "list.hoverForeground": p.ink,
      "list.focusBackground": withAlpha(p.accent, 0.16),
      "list.focusForeground": p.ink,
      "list.highlightForeground": p.accent,
      "scrollbarSlider.background": withAlpha(p.muted, 0.25),
      "scrollbarSlider.hoverBackground": withAlpha(p.muted, 0.4),
      "scrollbarSlider.activeBackground": withAlpha(p.muted, 0.55),
      "minimap.background": p.codeBg,
      "diffEditor.insertedTextBackground": withAlpha(p.pass, 0.14),
      "diffEditor.removedTextBackground": withAlpha(p.fail, 0.14),
    };

    monaco.editor.defineTheme(MONACO_THEME, {
      base: luminance(p.paper) < 0.4 ? "vs-dark" : "vs",
      inherit: true,
      rules: rules,
      colors: colors,
    });
    monaco.editor.setTheme(MONACO_THEME);
    return p;
  }

  // ── ambient types for the harness ──
  //
  // Without this, a challenge that writes its own `test(...)` is a wall of
  // "Cannot find name" errors, and `expect(x).` completes nothing. The URI is
  // fixed so a second registration replaces the lib instead of declaring every
  // matcher twice.
  var HARNESS_DTS = [
    "// The globals the dojo's test harness injects at run time.",
    "declare interface DojoMatchers {",
    "  toBe(expected: unknown): void;",
    "  toEqual(expected: unknown): void;",
    "  toBeCloseTo(expected: number, digits?: number): void;",
    "  toContain(expected: unknown): void;",
    "  toMatch(pattern: RegExp | string): void;",
    "  toThrow(matcher?: string | RegExp): void;",
    "  toBeTruthy(): void;",
    "  toBeFalsy(): void;",
    "  toBeNull(): void;",
    "  toBeUndefined(): void;",
    "  toBeDefined(): void;",
    "  toHaveLength(length: number): void;",
    "  toBeGreaterThan(value: number): void;",
    "  toBeLessThan(value: number): void;",
    "  toBeInstanceOf(ctor: Function): void;",
    "}",
    "declare interface DojoExpectation extends DojoMatchers {",
    "  /** Every matcher, negated. */",
    "  readonly not: DojoMatchers;",
    "}",
    "/** Assert on a value. */",
    "declare function expect(actual: any): DojoExpectation;",
    "/** Register a test. The function may be async; it will be awaited. */",
    "declare function test(name: string, fn: () => void | Promise<void>): void;",
    "/** Alias of test. */",
    "declare function it(name: string, fn: () => void | Promise<void>): void;",
    "/** Group tests; the name is prefixed onto each one. */",
    "declare function describe(name: string, fn: () => void): void;",
    "/** Throw with `message` unless `condition` is truthy. */",
    "declare function assert(condition: unknown, message?: string): void;",
    "",
  ].join("\n");

  function configureTypeScript(monaco) {
    var ts = monaco.languages.typescript;
    if (!ts) return;

    var options = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      // `dom` is not optional. Without it `console.log` — which the harness uses
      // and every learner debugging a challenge reaches for — reports "Cannot
      // find name 'console'", and a red squiggle under console.log would destroy
      // any trust in the squiggles that matter.
      lib: ["es2020", "dom", "dom.iterable"],
      strict: true,
      noEmit: true,
      allowNonTsExtensions: true,
      allowJs: true,
      skipLibCheck: true,
      // NOT set: moduleDetection. Forcing every model to be a module would stop
      // two `ts` challenges in one doc from sharing a global scope, but measured
      // against this Monaco build it also breaks lib resolution — `console`
      // disappears with it on. Sharing a scope is the lesser problem, and the
      // duplicate-identifier noise it can cause is filtered below.
    };
    ts.typescriptDefaults.setCompilerOptions(options);
    ts.javascriptDefaults.setCompilerOptions(options);

    // Squiggles. Semantic checking is on for TypeScript (that is the whole point)
    // and off for JavaScript, where without `checkJs` it produces more noise than
    // signal. Suggestion diagnostics stay off: "prefer const" is not the dojo's
    // business.
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      onlyVisible: false,
    });
    ts.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
    });

    // Eager sync: without it the worker only learns about a model when something
    // asks it to, and markers show up late or not at all.
    ts.typescriptDefaults.setEagerModelSync(true);
    ts.javascriptDefaults.setEagerModelSync(true);

    try {
      ts.typescriptDefaults.addExtraLib(HARNESS_DTS, MONACO_LIB_URI);
      ts.javascriptDefaults.addExtraLib(HARNESS_DTS, MONACO_LIB_URI);
    } catch (e) {
      /* already registered — the fixed URI makes this idempotent anyway */
    }
  }

  // ── the phantom-duplicate filter ──
  //
  // Every challenge in a doc is a separate model, but they all live in ONE
  // TypeScript project, and a file with no imports or exports is a global script.
  // So two `ts` challenges that both declare `const cache` — which is the normal
  // case, not a corner case; challenges in one doc are variations on a theme —
  // each get "Cannot redeclare block-scoped variable", pointing at a file the
  // reader cannot see and did not write.
  //
  // `moduleDetection: Force` is the textbook fix and it breaks `console` in this
  // build (measured), so instead we drop exactly the wrong markers. The
  // discriminator is exact, not a guess: TypeScript attaches relatedInformation
  // naming the other declaration site, so
  //
  //   · related info that all points at OTHER models → cross-challenge phantom;
  //   · no related info, or related info in this same file → the learner really
  //     did declare it twice, and that marker stays.
  //
  // Re-pushing markers re-fires the event, but the second pass finds nothing left
  // to remove and stops, so this converges whether the event is sync or async.
  var DUPLICATE_CODES = {
    2300: 1, // Duplicate identifier
    2308: 1, // Module already exported a member named …
    2393: 1, // Duplicate function implementation
    2395: 1, // Individual declarations in merged declaration must be all exported
    2403: 1, // Subsequent variable declarations must have the same type
    2451: 1, // Cannot redeclare block-scoped variable
    2567: 1, // Enum declarations can only merge with …
  };

  function markerCode(marker) {
    var code = marker.code;
    if (code && typeof code === "object") code = code.value;
    return String(code == null ? "" : code);
  }

  function isPhantomDuplicate(marker) {
    if (!DUPLICATE_CODES[markerCode(marker)]) return false;
    var related = marker.relatedInformation || [];
    if (!related.length) return false; // same-file duplicate: a real mistake
    var self = marker.resource ? marker.resource.toString() : "";
    for (var i = 0; i < related.length; i++) {
      var res = related[i].resource;
      if (!res || res.toString() === self) return false; // one of them is ours
    }
    return true;
  }

  function installMarkerFilter(monaco) {
    if (!monaco.editor.onDidChangeMarkers) return;
    var reentrant = false;
    monaco.editor.onDidChangeMarkers(function (resources) {
      if (reentrant) return;
      for (var i = 0; i < (resources || []).length; i++) {
        var uri = resources[i];
        // Only ever touch models this runtime created.
        if (!uri || String(uri.path || "").indexOf("/dojo/") !== 0) continue;
        var model = monaco.editor.getModel(uri);
        if (!model) continue;
        var owners = ["typescript", "javascript"];
        for (var o = 0; o < owners.length; o++) {
          var all = monaco.editor.getModelMarkers({ resource: uri, owner: owners[o] });
          if (!all.length) continue;
          var kept = [];
          for (var m = 0; m < all.length; m++) {
            if (!isPhantomDuplicate(all[m])) kept.push(all[m]);
          }
          if (kept.length === all.length) continue;
          reentrant = true;
          try {
            monaco.editor.setModelMarkers(model, owners[o], kept);
          } catch (e) {
            /* ignore */
          }
          reentrant = false;
        }
      }
    });
  }

  // ── the loader ──

  function loadMonaco() {
    if (monacoState.promise) return monacoState.promise;

    monacoState.promise = new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        monacoState.monaco = value;
        monacoState.failed = !value;
        resolve(value);
      }

      // If a load has already happened (two runtimes on one page, a doc that
      // ships Monaco itself), reuse it rather than fighting over the AMD loader.
      if (window.monaco && window.monaco.editor) {
        done(window.monaco);
        return;
      }

      var timer = setTimeout(function () {
        done(null); // slow link: stay on the textarea rather than hang forever
      }, MONACO_LOAD_TIMEOUT_MS);

      function finish(value) {
        clearTimeout(timer);
        done(value);
      }

      try {
        // MonacoEnvironment must exist BEFORE the loader runs: the first worker
        // is created during editor.main's initialisation, and if that creation
        // fails Monaco caches the broken client — there is no retrying in place,
        // only a reload. The worker URL is a real file because Chrome refuses to
        // construct a Worker from a data: URL.
        if (!window.MonacoEnvironment) {
          window.MonacoEnvironment = {
            getWorkerUrl: function () {
              return MONACO_WORKER_URL;
            },
          };
        }

        var script = document.createElement("script");
        script.src = MONACO_BASE + "/loader.js";
        script.async = true;
        script.onerror = function () {
          finish(null);
        };
        script.onload = function () {
          try {
            var amdRequire = window.require;
            if (!amdRequire || !amdRequire.config) {
              finish(null);
              return;
            }
            amdRequire.config({ paths: { vs: MONACO_BASE } });
            amdRequire(
              ["vs/editor/editor.main"],
              function () {
                try {
                  if (!window.monaco || !window.monaco.editor) {
                    finish(null);
                    return;
                  }
                  configureTypeScript(window.monaco);
                  installMarkerFilter(window.monaco);
                  wireAllBrains(window.monaco);
                  finish(window.monaco);
                } catch (e) {
                  finish(null);
                }
              },
              function () {
                finish(null); // AMD error callback: a chunk 404'd
              }
            );
          } catch (e) {
            finish(null);
          }
        };
        (document.head || document.documentElement).appendChild(script);
      } catch (e) {
        finish(null);
      }
    });

    return monacoState.promise;
  }

  // ── pluggable language brains ──
  //
  // The seam for real per-language intelligence — Pyodide + Jedi for Python is
  // the next one in. A brain is three optional plain functions, so whatever
  // provides them never has to know a thing about Monaco's provider interfaces:
  //
  //   registerLanguageBrain("python", {
  //     triggerCharacters: ["."],
  //     completion: async ({ code, offset, line, column, lang }) =>
  //       [{ label, insertText?, detail?, documentation?, kind? }],
  //     hover: async ({ code, offset, line, column, word }) =>
  //       ({ contents: "str.upper() -> str", range? }) | null,
  //     diagnostics: async ({ code, lang }) =>
  //       [{ message, severity?: "error"|"warning"|"info",
  //          startLineNumber, startColumn, endLineNumber, endColumn }],
  //   });
  //
  // Registration works before or after Monaco has loaded, and re-registering a
  // language replaces the previous brain.
  var languageBrains = {};
  var brainDisposables = {};

  function registerLanguageBrain(lang, brain) {
    if (!lang || !brain) return { dispose: function () {} };
    languageBrains[lang] = brain;
    if (monacoState.monaco) wireBrain(monacoState.monaco, lang);
    // Existing editors of that language should pick up its diagnostics now.
    for (var i = 0; i < monacoState.editors.length; i++) {
      if (monacoState.editors[i].lang === lang) monacoState.editors[i].revalidate();
    }
    return {
      dispose: function () {
        disposeBrain(lang);
        delete languageBrains[lang];
      },
    };
  }

  function disposeBrain(lang) {
    var list = brainDisposables[lang] || [];
    for (var i = 0; i < list.length; i++) {
      try {
        list[i].dispose();
      } catch (e) {
        /* already gone */
      }
    }
    brainDisposables[lang] = [];
  }

  function wireAllBrains(monaco) {
    for (var lang in languageBrains) {
      if (Object.prototype.hasOwnProperty.call(languageBrains, lang)) wireBrain(monaco, lang);
    }
  }

  // Adapt the plain-object brain contract onto Monaco's provider interfaces.
  function wireBrain(monaco, lang) {
    var brain = languageBrains[lang];
    var id = MONACO_LANG_ID[lang];
    if (!brain || !id) return;
    disposeBrain(lang); // replacing, not stacking
    brainDisposables[lang] = [];

    function context(model, position) {
      return {
        lang: lang,
        code: model.getValue(),
        offset: model.getOffsetAt(position),
        line: position.lineNumber,
        column: position.column,
        word: (model.getWordAtPosition(position) || {}).word || "",
      };
    }

    if (brain.completion) {
      brainDisposables[lang].push(
        monaco.languages.registerCompletionItemProvider(id, {
          triggerCharacters: brain.triggerCharacters || ["."],
          provideCompletionItems: function (model, position) {
            return Promise.resolve()
              .then(function () {
                return brain.completion(context(model, position));
              })
              .then(function (items) {
                var word = model.getWordUntilPosition(position);
                var range = {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: word.startColumn,
                  endColumn: word.endColumn,
                };
                var kinds = monaco.languages.CompletionItemKind;
                var out = [];
                for (var i = 0; i < (items || []).length; i++) {
                  var item = items[i];
                  var kindName = item.kind || "Property";
                  out.push({
                    label: item.label,
                    kind: kinds[kindName] != null ? kinds[kindName] : kinds.Property,
                    detail: item.detail,
                    documentation: item.documentation,
                    insertText: item.insertText != null ? item.insertText : item.label,
                    sortText: item.sortText,
                    range: item.range || range,
                  });
                }
                return { suggestions: out };
              })
              .catch(function () {
                return { suggestions: [] }; // a broken brain must not break typing
              });
          },
        })
      );
    }

    if (brain.hover) {
      brainDisposables[lang].push(
        monaco.languages.registerHoverProvider(id, {
          provideHover: function (model, position) {
            return Promise.resolve()
              .then(function () {
                return brain.hover(context(model, position));
              })
              .then(function (result) {
                if (!result) return null;
                var raw = result.contents == null ? result : result.contents;
                var list = Object.prototype.toString.call(raw) === "[object Array]" ? raw : [raw];
                var contents = [];
                for (var i = 0; i < list.length; i++) {
                  contents.push(typeof list[i] === "string" ? { value: list[i] } : list[i]);
                }
                return { contents: contents, range: result.range };
              })
              .catch(function () {
                return null;
              });
          },
        })
      );
    }
  }

  // ── the editor handle ──

  // Same shape as buildEditor's api, so every call site in this file — Reset,
  // getCode, the fonts.ready relayout — keeps working without knowing which
  // engine it is talking to.
  function buildMonacoEditor(monaco, lang, initial, hooks, metrics, challengeId) {
    var container = el("div", "dojo-monaco");
    var langId = MONACO_LANG_ID[lang] || "plaintext";
    var ext = MONACO_EXT[lang] || "txt";

    // A stable per-challenge URI: the TS service keys everything off it, and the
    // extension is how it decides which language service to run at all.
    var uri = monaco.Uri.parse("file:///dojo/" + (SLUG || "local") + "/" + challengeId + "." + ext);
    var model = monaco.editor.getModel(uri);
    if (model) {
      // Left over from an earlier upgrade of the same challenge.
      model.setValue(initial);
    } else {
      model = monaco.editor.createModel(initial, langId, uri);
    }

    var editor = monaco.editor.create(container, {
      model: model,
      theme: MONACO_THEME,
      automaticLayout: true, // the host page can resize us at any time
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      // The suggest widget re-parents itself into a position:fixed container so
      // the host page's overflow ancestors can't clip it. But position:fixed is
      // resolved against the nearest transformed ancestor, not the viewport, so on
      // a template that animates a wrapper the escape hatch would place the popup
      // somewhere absurd. In that case leave the widgets inside the editor, where
      // they are at least where the caret is.
      fixedOverflowWidgets: !hasTransformedAncestor(container),
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 8,
      glyphMargin: false,
      folding: false,
      renderLineHighlight: "line",
      renderWhitespace: "selection",
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { vertical: "auto", horizontal: "auto", useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      // Monaco colours nested brackets gold/orchid/blue by default, from its own
      // palette rather than the theme's — rainbow brackets in VS Code's colours
      // on somebody's cream-and-cobalt page. Off, so brackets take the
      // `delimiter.bracket` rule and match what the textarea editor draws.
      bracketPairColorization: { enabled: false },
      guides: { bracketPairs: false, indentation: true, highlightActiveIndentation: true },
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      trimAutoWhitespace: false,
      autoIndent: "full",
      formatOnPaste: false,
      wordWrap: "off",
      wordBasedSuggestions: "currentDocument", // what python/rust/go run on today
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "on",
      tabCompletion: "off",
      parameterHints: { enabled: true },
      hover: { enabled: true, delay: 250 },
      contextmenu: false, // the host page's own menu is less surprising
      padding: { top: 10, bottom: 10 },
      fontFamily: metrics.fontFamily,
      fontSize: metrics.fontSize,
      lineHeight: metrics.lineHeight,
      letterSpacing: 0,
      fontLigatures: false,
      smoothScrolling: false,
      cursorBlinking: metrics.reducedMotion ? "solid" : "blink",
      cursorSmoothCaretAnimation: "off",
      accessibilitySupport: "auto",
      ariaLabel: "Your solution (" + (LANG_LABEL[lang] || lang) + ")",
    });

    // Auto-grow to the content, between the same bounds the textarea uses, then
    // scroll internally.
    //
    // Clamped by LINE COUNT rather than getContentHeight(): content height
    // includes whatever the layout currently is, so feeding it back into the
    // height is a layout → resize → layout loop. Line count is an input that our
    // own resizing cannot change. The height is only assigned when it actually
    // differs, which is the second half of the same guard.
    function applyHeight() {
      try {
        var lh = editor.getOption(monaco.editor.EditorOption.lineHeight) || metrics.lineHeight;
        var lines = Math.min(MAX_LINES, Math.max(MIN_LINES, model.getLineCount()));
        var next = Math.ceil(lines * lh + 20) + "px"; // 20 = the padding option below
        if (container.style.height !== next) {
          container.style.height = next;
          editor.layout();
        }
      } catch (e) {
        /* leave the last good height */
      }
    }

    var subs = [];
    subs.push(editor.onDidContentSizeChange(applyHeight));
    subs.push(
      editor.onDidChangeModelContent(function () {
        if (hooks.onChange) hooks.onChange();
        scheduleBrainDiagnostics();
      })
    );

    // Cmd/Ctrl+Enter runs. addAction binds only that chord, so Enter still
    // belongs to the suggest widget — which is the whole reason not to reuse the
    // textarea's keydown handler here.
    editor.addAction({
      id: "dojo.run",
      label: "Run the dojo tests",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: function () {
        if (hooks.onRun) hooks.onRun();
      },
    });
    editor.addAction({
      id: "dojo.save",
      label: "Save a dojo checkpoint",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: function () {
        if (hooks.onSave) hooks.onSave();
      },
    });

    // Brain diagnostics live in their own marker owner so Monaco's own TS
    // markers and a language brain's markers can coexist.
    var brainTimer = null;
    var markerOwner = "dojo-brain-" + lang;
    function scheduleBrainDiagnostics() {
      var brain = languageBrains[lang];
      if (!brain || !brain.diagnostics) return;
      if (brainTimer) clearTimeout(brainTimer);
      brainTimer = setTimeout(runBrainDiagnostics, 400);
    }
    function runBrainDiagnostics() {
      var brain = languageBrains[lang];
      if (!brain || !brain.diagnostics || model.isDisposed()) return;
      Promise.resolve()
        .then(function () {
          return brain.diagnostics({ lang: lang, code: model.getValue() });
        })
        .then(function (list) {
          if (model.isDisposed()) return;
          var severities = monaco.MarkerSeverity;
          var markers = [];
          for (var i = 0; i < (list || []).length; i++) {
            var d = list[i];
            var sev =
              d.severity === "warning"
                ? severities.Warning
                : d.severity === "info"
                  ? severities.Info
                  : severities.Error;
            markers.push({
              message: d.message,
              severity: sev,
              startLineNumber: d.startLineNumber || 1,
              startColumn: d.startColumn || 1,
              endLineNumber: d.endLineNumber || d.startLineNumber || 1,
              endColumn: d.endColumn || (d.startColumn || 1) + 1,
            });
          }
          monaco.editor.setModelMarkers(model, markerOwner, markers);
        })
        .catch(function () {
          /* advisory only */
        });
    }

    var api = {
      root: container,
      isMonaco: true,
      lang: lang,
      editor: editor,
      model: model,
      get: function () {
        return model.getValue();
      },
      set: function (value) {
        // pushEditOperations rather than setValue: it keeps the undo stack, so
        // Reset is undoable like every other edit.
        model.pushEditOperations(
          [],
          [{ range: model.getFullModelRange(), text: value }],
          function () {
            return null;
          }
        );
        applyHeight();
      },
      focus: function () {
        editor.focus();
      },
      refresh: function () {
        editor.layout();
        applyHeight();
      },
      // Monaco measures the monospace cell once and caches it. If the template's
      // --dojo-font-mono is a webfont that hadn't arrived yet, every column is
      // measured against the fallback face and the whole grid is subtly wrong —
      // the same class of bug the textarea editor's shared-metrics rule avoids.
      // remeasureFonts() is the only cure, and it is global, not per editor.
      remeasure: function () {
        try {
          monaco.editor.remeasureFonts();
        } catch (e) {
          /* older builds manage without */
        }
        editor.layout();
        applyHeight();
      },
      revalidate: scheduleBrainDiagnostics,
      mount: applyHeight,
      dispose: function () {
        for (var i = 0; i < subs.length; i++) {
          try {
            subs[i].dispose();
          } catch (e) {
            /* ignore */
          }
        }
        if (brainTimer) clearTimeout(brainTimer);
        try {
          editor.dispose();
        } catch (e) {
          /* ignore */
        }
        try {
          model.dispose();
        } catch (e) {
          /* ignore */
        }
        var at = monacoState.editors.indexOf(api);
        if (at >= 0) monacoState.editors.splice(at, 1);
      },
    };

    monacoState.editors.push(api);
    applyHeight();
    scheduleBrainDiagnostics();

    // Webfonts almost always land before Monaco is asked for (it loads on the
    // first edit), but "almost" is not a guarantee — and if fonts.ready has
    // already settled this callback runs immediately and costs nothing.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        if (!model.isDisposed()) api.remeasure();
      });
    }

    return api;
  }

  // ── the swap ──

  // `position: fixed` inside a transformed subtree is positioned against that
  // subtree, not the viewport. Walk up once at construction time to find out.
  function hasTransformedAncestor(node) {
    try {
      var el2 = node.parentElement;
      while (el2 && el2 !== document.body) {
        var cs = window.getComputedStyle(el2);
        if (
          (cs.transform && cs.transform !== "none") ||
          (cs.filter && cs.filter !== "none") ||
          (cs.perspective && cs.perspective !== "none") ||
          (cs.willChange && /transform|filter|perspective/.test(cs.willChange))
        ) {
          return true;
        }
        el2 = el2.parentElement;
      }
    } catch (e) {
      /* assume not */
    }
    return false;
  }

  // Is the rich editor the right call on this device at all?
  //
  // On a phone it is not. Monaco's touch handling is materially worse than a
  // plain textarea — text selection, the on-screen keyboard, and scrolling all
  // regress — and the suggest widget has nowhere to go on a 360px viewport. The
  // textarea path is the better editor there, so small and touch-primary
  // viewports keep it. That is a decision, not a gap.
  function monacoWorthIt() {
    try {
      if (window.innerWidth && window.innerWidth < 700) return false;
      if (window.matchMedia) {
        if (window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches) {
          return false;
        }
      }
    } catch (e) {
      /* if we can't tell, the desktop assumption is the safer one */
    }
    return true;
  }

  // Arm one challenge: the first focus or pointer press inside its editor is the
  // signal that somebody means to write code here, which is when Monaco becomes
  // worth several megabytes and not before.
  function armMonacoUpgrade(state) {
    if (!state.editor || state.editor.isMonaco) return;
    if (!monacoWorthIt()) return;
    var root = state.editor.root;
    var fired = false;
    function intent() {
      if (fired) return;
      fired = true;
      root.removeEventListener("focusin", intent);
      root.removeEventListener("pointerdown", intent);
      upgradeToMonaco(state);
    }
    root.addEventListener("focusin", intent);
    root.addEventListener("pointerdown", intent);
  }

  function upgradeToMonaco(state) {
    if (state.monacoRequested) return;
    state.monacoRequested = true;
    if (monacoState.failed) return; // already tried and failed once this page

    // A quiet note while several megabytes arrive, so the swap doesn't look like
    // a glitch. Removed either way.
    var hint = el("span", "dojo-upgrading", "loading rich editor…");
    if (state.bar) state.bar.appendChild(hint);
    function clearHint() {
      if (hint.parentNode) hint.parentNode.removeChild(hint);
    }

    loadMonaco().then(function (monaco) {
      clearHint();
      if (!monaco) return; // silently stay on the textarea
      try {
        swapInMonaco(state, monaco);
      } catch (e) {
        // Anything at all: keep the working editor. The textarea is still in the
        // DOM at this point unless the swap got all the way to the end.
        try {
          if (window.console && console.warn) console.warn("[dojo] monaco upgrade skipped:", e);
        } catch (e2) {
          /* ignore */
        }
      }
    });
  }

  function swapInMonaco(state, monaco) {
    var old = state.editor;
    if (!old || old.isMonaco) return;

    // Theme once per page, off a real challenge element so the doc's variables
    // (and this file's fallbacks for the ones it didn't set) are what we read.
    if (!monacoState.themed) {
      defineMonacoTheme(monaco, state.shell.closest(".dojo-challenge") || state.shell);
      monacoState.themed = true;
    }

    // Carry the textarea's measured metrics across so the text does not change
    // size or line rhythm as the engine changes underneath it.
    var cs = window.getComputedStyle(old.textarea);
    var reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      /* assume motion is fine */
    }
    var metrics = {
      fontFamily: cs.fontFamily,
      fontSize: parseFloat(cs.fontSize) || 13,
      lineHeight: parseFloat(cs.lineHeight) || Math.round((parseFloat(cs.fontSize) || 13) * 1.55),
      reducedMotion: reduced,
    };

    var text = old.get();
    var hadFocus = document.activeElement === old.textarea;
    var caret = old.textarea.selectionStart;

    var next = buildMonacoEditor(monaco, state.lang, text, state.editorHooks, metrics, state.id);

    // Only now, with a working editor in hand, is the textarea removed.
    old.root.parentNode.insertBefore(next.root, old.root);
    old.root.parentNode.removeChild(old.root);
    state.editor = next;

    // Put the caret back where they left it, and only take focus if they had it —
    // stealing focus on a background challenge would scroll the page out from
    // under them.
    try {
      var position = next.model.getPositionAt(Math.max(0, Math.min(text.length, caret || 0)));
      next.editor.setPosition(position);
      if (hadFocus) {
        next.editor.focus();
        next.editor.revealPositionInCenterIfOutsideViewport(position);
      }
    } catch (e) {
      /* caret restoration is a nicety */
    }
    next.refresh();
  }

  // ── Page-level state ───────────────────────────────────────────────────

  // The server writes window.__DOJO__ = { slug } immediately above our script
  // tag. If it is missing the doc was opened as a bare file, or served by
  // something that doesn't know about the dojo — in which case everything still
  // works locally and nothing is recorded.
  var DOJO = window.__DOJO__ || {};
  var SLUG = typeof DOJO.slug === "string" && DOJO.slug ? DOJO.slug : null;

  var progress = {
    author: null,
    // Optimistic while the fetch is in flight, and if the endpoint doesn't exist
    // yet: a POST that quietly fails is a smaller harm than hiding Submit from
    // the person whose dojo this is. A real `canSubmit: false` hides it.
    canSubmit: !!SLUG,
    solved: {},
    attemptsByChallenge: {},
    loaded: false,
  };

  var challenges = [];
  var strip = null;

  function wipKey(id) {
    return "dojo:" + (SLUG || "local") + ":" + id;
  }
  function metaKey(id) {
    return wipKey(id) + ":meta";
  }

  // ── Results panel ──────────────────────────────────────────────────────

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function showPending(state, text) {
    clear(state.results);
    state.results.appendChild(el("div", "dojo-pending", text));
  }

  function renderResults(state, outcome) {
    var box = state.results;
    clear(box);

    var summary = el("div", "dojo-summary " + (outcome.green ? "dojo-summary--green" : outcome.total ? "dojo-summary--red" : ""));
    var count = el("span", "dojo-count");
    if (!outcome.total) count.textContent = outcome.ok ? "no tests ran" : "didn't run";
    else count.textContent = outcome.passed + " of " + outcome.total + " passing";
    summary.appendChild(count);
    if (outcome.green) {
      summary.appendChild(el("span", null, "— green. Submit to claim it."));
    }
    var where = el("span", "dojo-where");
    where.textContent = (outcome.where === "sandbox" ? "server" : "browser") + " · " + fmtMs(outcome.ms);
    summary.appendChild(where);
    box.appendChild(summary);

    if (outcome.note) box.appendChild(el("p", "dojo-note", outcome.note));

    if (outcome.tests && outcome.tests.length) {
      var list = el("ul", "dojo-testlist");
      for (var i = 0; i < outcome.tests.length; i++) {
        var t = outcome.tests[i];
        var status = t.status === "pass" ? "pass" : t.status === "fail" ? "fail" : "error";
        var item = el("li", "dojo-test dojo-test--" + status);
        item.appendChild(el("span", "dojo-test-mark", status === "pass" ? "✓" : "✗"));
        var body = el("div", "dojo-test-body");
        body.appendChild(el("span", "dojo-test-name", t.name || "test"));
        if (t.message && status !== "pass") body.appendChild(el("span", "dojo-test-msg", t.message));
        item.appendChild(body);
        list.appendChild(item);
      }
      box.appendChild(list);
    }

    // The learner's own console.log output, kept separate from test results,
    // because printing things is how you debug and it deserves its own place.
    if (outcome.stdout) box.appendChild(outputBlock("Output", outcome.stdout, false));
    if (outcome.stderr) box.appendChild(outputBlock("Errors", outcome.stderr, true));

    // The entire celebration: the frame takes the accent for a beat.
    state.shell.classList.toggle("dojo-shell--green", !!outcome.green);
  }

  function outputBlock(label, text, isError) {
    var wrap = el("div", "dojo-outblock");
    wrap.appendChild(el("div", "dojo-outlabel", label));
    wrap.appendChild(el("pre", "dojo-outpre" + (isError ? " dojo-outpre--err" : ""), text));
    return wrap;
  }

  // ── Recording ──────────────────────────────────────────────────────────

  function outcomeForWire(outcome) {
    return {
      green: !!(outcome && outcome.green),
      passed: (outcome && outcome.passed) || 0,
      total: (outcome && outcome.total) || 0,
      tests: (outcome && outcome.tests) || [],
      stderr: (outcome && outcome.stderr) || "",
      ms: (outcome && outcome.ms) || 0,
    };
  }

  // Every Run is reported, not just every Submit. That is deliberate: the point
  // of the attempts store is that the learner's coaching agent can read the code
  // they were actually staring at when they got stuck, and the interesting code
  // is nearly always in a run that failed.
  function record(state, kind, outcome) {
    if (!SLUG || !progress.canSubmit) return;
    postJSON("/api/dojo/submit", {
      slug: SLUG,
      challengeId: state.id,
      title: state.title,
      lang: state.lang,
      skills: state.skills,
      shape: state.shape,
      kind: kind,
      code: state.getCode(),
      outcome: outcomeForWire(outcome),
      elapsedMs: elapsedOf(state),
      runCount: state.runCount,
    });
  }

  // ── Per-challenge bookkeeping ──────────────────────────────────────────

  function elapsedOf(state) {
    var live = state.sessionStart ? now() - state.sessionStart : 0;
    return Math.round(state.elapsedBase + live);
  }

  function noteFirstKeystroke(state) {
    // The clock starts at the first keystroke, not at page load: time spent
    // reading the brief is not time spent stuck.
    if (!state.sessionStart) state.sessionStart = now();
  }

  function saveMeta(state) {
    lsSet(
      metaKey(state.id),
      JSON.stringify({ runCount: state.runCount, elapsedMs: elapsedOf(state), solved: !!state.solved })
    );
  }

  function loadMeta(state) {
    try {
      var raw = lsGet(metaKey(state.id));
      if (!raw) return;
      var data = JSON.parse(raw);
      state.runCount = typeof data.runCount === "number" ? data.runCount : 0;
      state.elapsedBase = typeof data.elapsedMs === "number" ? data.elapsedMs : 0;
      if (data.solved) state.solved = true;
    } catch (e) {
      /* corrupt entry: start clean */
    }
  }

  function updateClock(state) {
    if (!state.clock) return;
    var bits = [];
    if (state.runCount) bits.push(state.runCount + (state.runCount === 1 ? " run" : " runs"));
    var ms = elapsedOf(state);
    if (ms > 1000) bits.push(fmtDuration(ms));
    state.clock.textContent = bits.join(" · ");
  }

  function markSolved(state, solved) {
    state.solved = !!solved;
    state.shell.classList.toggle("dojo-shell--solved", state.solved);
    if (state.badge) state.badge.style.display = state.solved ? "" : "none";
    saveMeta(state);
    updateStrip();
  }

  // ── Status strip ───────────────────────────────────────────────────────

  // Placed immediately before the first challenge rather than jammed at the top
  // of <body>: templates put fixed headers, hero images and grid wrappers up
  // there, and a guest element has no business guessing at that layout.
  function buildStrip(firstChallenge) {
    var node = el("div", "dojo-strip");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    var count = el("span", "dojo-strip-count", "0 of 0");
    var label = el("span", null, "challenges green");
    var bar = el("div", "dojo-strip-bar");
    var fill = el("span", "dojo-strip-fill");
    bar.appendChild(fill);
    node.appendChild(count);
    node.appendChild(label);
    node.appendChild(bar);
    if (firstChallenge.parentNode) firstChallenge.parentNode.insertBefore(node, firstChallenge);
    return { root: node, count: count, label: label, fill: fill, done: null };
  }

  function updateStrip() {
    if (!strip) return;
    var total = challenges.length;
    var green = 0;
    for (var i = 0; i < challenges.length; i++) if (challenges[i].solved) green++;
    strip.count.textContent = green + " of " + total;
    strip.fill.style.width = total ? Math.round((green / total) * 100) + "%" : "0%";
    if (green === total && total > 0) {
      if (!strip.done) {
        strip.done = el("span", "dojo-strip-all", "— all green");
        strip.root.appendChild(strip.done);
      }
    } else if (strip.done) {
      strip.root.removeChild(strip.done);
      strip.done = null;
    }
  }

  // ── Building a challenge ───────────────────────────────────────────────

  function textOf(section, cls) {
    var node = section.querySelector("script.dojo-" + cls);
    return node ? dedent(node.textContent) : "";
  }

  function setupChallenge(section, index) {
    if (section.getAttribute("data-dojo-ready") === "1") return null;

    // A section with neither starter nor tests isn't a challenge yet — a
    // half-written doc, or markup that only borrowed the class name. Leave it
    // exactly as authored rather than hydrating an empty editor over it, and
    // keep it out of the "N of M green" count.
    if (!section.querySelector("script.dojo-starter") && !section.querySelector("script.dojo-tests")) {
      return null;
    }

    var lang = section.getAttribute("data-lang") || "js";
    if (!LANGS[lang]) lang = "js";
    var shape = section.getAttribute("data-shape") || "implement";
    var skillsAttr = section.getAttribute("data-skills") || "";
    var skills = skillsAttr
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);

    var state = {
      id: section.getAttribute("data-challenge") || "challenge-" + (index + 1),
      title: section.getAttribute("data-title") || "Challenge " + (index + 1),
      lang: lang,
      shape: shape,
      skills: skills,
      starter: textOf(section, "starter"),
      tests: textOf(section, "tests"),
      solution: textOf(section, "solution"),
      runCount: 0,
      elapsedBase: 0,
      sessionStart: null,
      solved: false,
      busy: false,
      lastOutcome: null,
      revealed: false,
      editor: null,
      answer: null,
    };
    loadMeta(state);

    // ── frame ──
    var shell = el("div", "dojo-shell");
    state.shell = shell;

    var head = el("div", "dojo-head");
    var title = el("h3", "dojo-title", state.title);
    head.appendChild(title);
    var meta = el("div", "dojo-meta");
    meta.appendChild(el("span", "dojo-tag dojo-tag--shape", shape));
    meta.appendChild(el("span", "dojo-tag", LANG_LABEL[lang] || lang));
    for (var s = 0; s < skills.length && s < 4; s++) {
      meta.appendChild(el("span", "dojo-tag", skills[s]));
    }
    var badge = el("span", "dojo-tag dojo-solvedbadge", "solved");
    badge.style.display = "none";
    state.badge = badge;
    meta.appendChild(badge);
    head.appendChild(meta);
    shell.appendChild(head);

    // The brief is the authoring agent's prose in the doc's own type styles.
    // It moves into the frame untouched — no restyling, no rewriting.
    var brief = section.querySelector(".dojo-brief");
    if (brief) shell.appendChild(brief);

    // ── body: an editor, or the predict shape's read-only code + answer ──
    var isPredict = shape === "predict";
    if (isPredict) {
      buildPredictBody(state, section, shell);
    } else {
      var saved = lsGet(wipKey(state.id));
      var initial = saved != null ? saved : state.starter;
      // Held on the state because the Monaco upgrade re-uses them verbatim: WIP
      // saving, the elapsed clock and Cmd+S must behave identically whichever
      // engine is mounted.
      state.editorHooks = {
        onChange: function () {
          noteFirstKeystroke(state);
          saveWip();
          updateClock(state);
        },
        onRun: function () {
          runNow("run");
        },
        onSave: function () {
          // Cmd+S is a checkpoint, not a run: write through immediately and say
          // so, because muscle memory deserves an acknowledgement.
          lsSet(wipKey(state.id), state.editor.get());
          saveMeta(state);
          flash(state, "saved");
        },
      };
      state.editor = buildEditor(lang, initial, state.editorHooks);
      state.getCode = function () {
        return state.editor.get();
      };
      shell.appendChild(state.editor.root);
    }

    var saveWip = debounce(function () {
      if (state.editor) lsSet(wipKey(state.id), state.editor.get());
      saveMeta(state);
    }, SAVE_DEBOUNCE_MS);

    // ── controls ──
    var bar = el("div", "dojo-bar");
    var runBtn = el("button", "dojo-btn dojo-btn--primary", isPredict ? "Check answer" : "Run tests");
    runBtn.type = "button";
    runBtn.title = isPredict ? "Check your prediction" : "Run the tests (Cmd/Ctrl+Enter)";
    bar.appendChild(runBtn);

    var submitBtn = el("button", "dojo-btn", "Submit");
    submitBtn.type = "button";
    submitBtn.title = "Claim this challenge — records the attempt in your ledger";
    bar.appendChild(submitBtn);

    var stuckBtn = el("button", "dojo-btn", "I'm stuck");
    stuckBtn.type = "button";
    stuckBtn.title = "Save this attempt for your agent to coach against";
    bar.appendChild(stuckBtn);

    var revealBtn = null;
    if (state.solution) {
      revealBtn = el("button", "dojo-btn", "Reveal solution");
      revealBtn.type = "button";
      revealBtn.title = "Show the reference solution (recorded)";
      bar.appendChild(revealBtn);
    }

    var resetBtn = el("button", "dojo-btn", "Reset");
    resetBtn.type = "button";
    resetBtn.title = isPredict ? "Clear your answer" : "Restore the starter code";
    bar.appendChild(resetBtn);

    var clock = el("span", "dojo-clock dojo-spacer");
    state.clock = clock;
    bar.appendChild(clock);
    shell.appendChild(bar);
    state.bar = bar; // the upgrade hangs its "loading…" note here

    state.submitBtn = submitBtn;
    state.stuckBtn = stuckBtn;

    // One line, once, when nothing can be recorded. Not a banner, not a nag.
    var noteLine = el("div", "dojo-readonly-note");
    noteLine.style.display = "none";
    state.noteLine = noteLine;
    shell.appendChild(noteLine);

    var results = el("div", "dojo-results");
    results.setAttribute("aria-live", "polite");
    results.setAttribute("aria-atomic", "false");
    state.results = results;
    shell.appendChild(results);

    section.appendChild(shell);
    section.setAttribute("data-dojo-ready", "1");
    if (state.editor) state.editor.mount();
    if (state.solved) markSolved(state, true);
    updateClock(state);
    // First paint is always the textarea; Monaco arrives only if they start
    // editing. Nothing above this line touches the network.
    if (state.editor) armMonacoUpgrade(state);

    // ── behaviour ──

    function setBusy(busy) {
      state.busy = busy;
      runBtn.disabled = busy;
      submitBtn.disabled = busy;
      if (revealBtn) revealBtn.disabled = busy;
      resetBtn.disabled = busy;
    }

    function runNow(kind) {
      if (state.busy) return;
      if (kind === "run") {
        state.runCount += 1;
        updateClock(state);
      }
      setBusy(true);

      if (isPredict) {
        var graded = gradePrediction(state);
        setBusy(false);
        finishRun(kind, graded);
        return;
      }

      var serverBound = !BROWSER_LANGS[state.lang];
      showPending(state, serverBound ? "running on the server…" : "running…");

      runChallenge({
        slug: SLUG || "",
        challengeId: state.id,
        lang: state.lang,
        code: state.getCode(),
        tests: state.tests,
      })
        .then(function (outcome) {
          setBusy(false);
          finishRun(kind, outcome);
        })
        .catch(function (e) {
          // runChallenge is written not to reject; this is belt and braces so a
          // surprise can never leave the buttons disabled forever.
          setBusy(false);
          renderResults(
            state,
            tallyOutcome({
              ok: false,
              tests: [{ name: "runner", status: "error", message: (e && e.message) || String(e) }],
              where: serverBound ? "sandbox" : "browser",
            })
          );
        });
    }

    function finishRun(kind, outcome) {
      state.lastOutcome = outcome;
      renderResults(state, outcome);
      saveMeta(state);
      updateClock(state);
      if (kind === "submit" && outcome.green) {
        markSolved(state, true);
        // A green submit closes the book on this attempt series, so the run
        // counter starts fresh — the next Run is a new question.
        state.runCount = 0;
        updateClock(state);
      }
      record(state, kind, outcome);
    }

    runBtn.addEventListener("click", function () {
      runNow("run");
    });

    submitBtn.addEventListener("click", function () {
      // Submit always runs first: a claim should be backed by a result from the
      // code that is in the box right now, not by whatever the last run said.
      runNow("submit");
    });

    stuckBtn.addEventListener("click", function () {
      record(state, "stuck", state.lastOutcome || tallyOutcome({ tests: [], where: "browser" }));
      flash(state, "Saved for your agent — ask it for a hint on “" + state.title + "”.");
    });

    if (revealBtn) {
      revealBtn.addEventListener("click", function () {
        if (state.revealed) return;
        var ok = window.confirm(
          "Show the reference solution for “" +
            state.title +
            "”?\n\nThis is recorded in your ledger and costs mastery on these skills. Try “I'm stuck” first if you want a hint instead."
        );
        if (!ok) return;
        state.revealed = true;
        revealBtn.disabled = true;
        revealBtn.textContent = "Solution shown";
        var label = el("div", "dojo-outlabel", "Reference solution");
        label.style.padding = "0 .9rem";
        shell.insertBefore(label, state.results);
        shell.insertBefore(buildReadOnlyCode(state.lang, state.solution, "Reference solution"), state.results);
        record(state, "reveal", state.lastOutcome || tallyOutcome({ tests: [], where: "browser" }));
      });
    }

    resetBtn.addEventListener("click", function () {
      var ok = window.confirm(
        isPredict ? "Clear your answer?" : "Restore the starter code? Your current version will be lost."
      );
      if (!ok) return;
      lsDel(wipKey(state.id));
      if (state.editor) {
        state.editor.set(state.starter);
        state.editor.focus();
      } else if (state.answer) {
        state.answer.clear();
      }
      clear(state.results);
      state.shell.classList.remove("dojo-shell--green");
      state.lastOutcome = null;
    });

    return state;
  }

  // A one-line transient acknowledgement in the results region (which is
  // aria-live, so it is announced without stealing focus).
  function flash(state, text) {
    var line = el("div", "dojo-pending", text);
    state.results.insertBefore(line, state.results.firstChild);
    setTimeout(function () {
      if (line.parentNode) line.parentNode.removeChild(line);
    }, 6000);
  }

  // ── The predict shape ──────────────────────────────────────────────────
  //
  // No editor: the code is fixed and the question is what it does. The expected
  // answer is the dojo-tests block, compared as trimmed text — deliberately
  // simple, because the interesting record here is "did they see it coming",
  // not a test suite.

  function buildPredictBody(state, section, shell) {
    shell.appendChild(buildReadOnlyCode(state.lang, state.starter, "Code to predict"));

    var box = el("div", "dojo-answer");
    var choicesAttr = section.getAttribute("data-choices");
    var inputId = "dojo-answer-" + state.id.replace(/[^A-Za-z0-9_-]/g, "-");

    if (choicesAttr) {
      var legend = el("div", null, "What does this produce?");
      box.appendChild(legend);
      var choices = choicesAttr.split("|");
      var name = inputId;
      var radios = [];
      for (var i = 0; i < choices.length; i++) {
        var row = el("label");
        row.style.display = "flex";
        row.style.gap = ".4rem";
        row.style.alignItems = "flex-start";
        var radio = el("input");
        radio.type = "radio";
        radio.name = name;
        radio.value = choices[i].trim();
        row.appendChild(radio);
        row.appendChild(el("span", null, choices[i].trim()));
        box.appendChild(row);
        radios.push(radio);
      }
      state.answer = {
        read: function () {
          for (var j = 0; j < radios.length; j++) if (radios[j].checked) return radios[j].value;
          return "";
        },
        clear: function () {
          for (var k = 0; k < radios.length; k++) radios[k].checked = false;
        },
      };
    } else {
      var label = el("label", null, "What does this print?");
      label.setAttribute("for", inputId);
      var area = el("textarea");
      area.id = inputId;
      area.spellcheck = false;
      area.setAttribute("spellcheck", "false");
      area.setAttribute("wrap", "off");
      var savedAnswer = lsGet(wipKey(state.id));
      if (savedAnswer != null) area.value = savedAnswer;
      area.addEventListener("input", function () {
        noteFirstKeystroke(state);
        lsSet(wipKey(state.id), area.value);
        updateClock(state);
      });
      box.appendChild(label);
      box.appendChild(area);
      state.answer = {
        read: function () {
          return area.value;
        },
        clear: function () {
          area.value = "";
        },
      };
    }

    shell.appendChild(box);
    state.getCode = function () {
      return state.answer.read();
    };
  }

  // Trimmed, whitespace-collapsed, case-insensitive: the learner is predicting
  // behaviour, not transcribing punctuation.
  function normalizeAnswer(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(function (line) {
        return line.trim().replace(/\s+/g, " ");
      })
      .join("\n")
      .replace(/^\n+|\n+$/g, "")
      .toLowerCase();
  }

  function gradePrediction(state) {
    var given = state.answer.read();
    var expected = state.tests;
    var right = normalizeAnswer(given) === normalizeAnswer(expected);
    return tallyOutcome({
      ok: true,
      where: "browser",
      ms: 0,
      tests: [
        {
          name: "your prediction",
          status: right ? "pass" : "fail",
          message: right ? "" : normalizeAnswer(given) ? "not what it produces" : "no answer yet",
        },
      ],
    });
  }

  // ── Progress ───────────────────────────────────────────────────────────

  function applyProgress(data) {
    progress.loaded = true;
    progress.author = data && typeof data.author === "string" ? data.author : null;
    progress.canSubmit = !!(data && data.canSubmit);
    progress.attemptsByChallenge = (data && data.attemptsByChallenge) || {};

    var solved = (data && Array.isArray(data.solved) ? data.solved : []).slice();
    for (var i = 0; i < challenges.length; i++) {
      var state = challenges[i];
      if (solved.indexOf(state.id) >= 0) markSolved(state, true);
      applySubmitVisibility(state);
    }
    updateStrip();
  }

  function applySubmitVisibility(state) {
    if (progress.canSubmit) {
      state.submitBtn.style.display = "";
      state.stuckBtn.style.display = "";
      state.noteLine.style.display = "none";
      return;
    }
    // Somebody else's dojo, or a doc the shelf isn't serving. Runs still work —
    // that is the whole point of a published dojo — but there is nowhere to file
    // the result, so the two buttons that only make sense for the owner go away
    // and exactly one quiet line says why.
    state.submitBtn.style.display = "none";
    state.stuckBtn.style.display = "none";
    state.noteLine.textContent = SLUG
      ? "You're reading " + (progress.author ? progress.author + "'s" : "someone else's") + " dojo — run anything you like; nothing is recorded."
      : "Local preview — your work is kept in this browser only.";
    state.noteLine.style.display = "";
  }

  function fetchProgress() {
    if (!SLUG) {
      progress.canSubmit = false;
      for (var i = 0; i < challenges.length; i++) applySubmitVisibility(challenges[i]);
      return;
    }
    fetch("/api/dojo/progress?slug=" + encodeURIComponent(SLUG), {
      credentials: "same-origin",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("progress " + res.status);
        return res.json();
      })
      .then(applyProgress)
      .catch(function () {
        // No endpoint (yet), offline, or a 500. Stay optimistic and quiet: the
        // editor is the product, the ledger is the bonus.
      });
  }

  // ── Init ───────────────────────────────────────────────────────────────

  function init() {
    var sections = document.querySelectorAll("section.dojo-challenge, .dojo-challenge");
    if (!sections.length) return;
    injectStyle();

    strip = buildStrip(sections[0]);

    for (var i = 0; i < sections.length; i++) {
      try {
        var state = setupChallenge(sections[i], i);
        if (state) challenges.push(state);
      } catch (e) {
        // One malformed challenge must not take the others — or the host
        // document — down with it. Leave the authored markup as it stands.
        try {
          if (window.console && console.warn) {
            console.warn("[dojo] skipped a challenge:", e && e.message ? e.message : e);
          }
        } catch (e2) {
          /* nothing more to do */
        }
      }
    }

    updateStrip();
    for (var j = 0; j < challenges.length; j++) applySubmitVisibility(challenges[j]);
    fetchProgress();

    // Web fonts land after first paint and change the line box, so the editors
    // re-measure once the document's real monospace face is in.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        for (var k = 0; k < challenges.length; k++) {
          if (challenges[k].editor) challenges[k].editor.remeasure();
        }
      });
    }
  }

  // The public surface: a version, the live challenge states, and the pure
  // pieces (highlighter, stripper, protocol parser, runner) exposed so they can
  // be poked at from the console when something looks wrong in a published doc.
  window.__DOJO_RUNTIME__ = {
    version: VERSION,
    slug: SLUG,
    challenges: challenges,
    progress: progress,
    highlight: highlight,
    stripTypes: stripTypes,
    parseProtocol: parseProtocol,
    run: runChallenge,
    // The Monaco seam: `registerLanguageBrain(lang, brain)` is how real
    // per-language intelligence (Pyodide + Jedi for python, next) plugs in
    // without touching this file. `upgrade()` forces the lazy load — useful from
    // the console, and how you check whether it is available at all.
    registerLanguageBrain: registerLanguageBrain,
    languageBrains: languageBrains,
    monaco: monacoState,
    upgrade: function () {
      var pending = [];
      for (var i = 0; i < challenges.length; i++) {
        if (challenges[i].editor && !challenges[i].editor.isMonaco) {
          upgradeToMonaco(challenges[i]);
          pending.push(challenges[i].id);
        }
      }
      return loadMonaco().then(function (monaco) {
        return { loaded: !!monaco, upgraded: pending };
      });
    },
    refresh: function () {
      for (var i = 0; i < challenges.length; i++) {
        if (challenges[i].editor) challenges[i].editor.remeasure();
      }
      updateStrip();
    },
  };

  // Injected at the end of <body> in some templates and in <head> in others, so
  // handle both: run now if the DOM is already parsed, otherwise wait.
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        try {
          init();
        } catch (e) {
          /* never take the host document down */
        }
      });
    } else {
      init();
    }
  } catch (e) {
    /* never take the host document down */
  }
})();
