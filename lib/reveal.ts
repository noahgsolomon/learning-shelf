// Chrome injected into verbatim-served HTML (docs at /d/<slug>, about pages at
// /who/<author>). Both routes hand the browser someone else's self-contained
// document, so the only things added are the shelf's favicon and — when the
// visit came from the board with ?curtain=<hex> — the reveal half of the pixel
// curtain. Direct visits with no param are served byte-identical.

// The shelf's own icons (mirroring app/layout.tsx), slotted into the doc's
// <head> — or ahead of the document if it somehow has none.
export function injectFavicon(html: string): string {
  const links =
    `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32">` +
    `<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32">`;
  return insertAfter(html, /<head[^>]*>/i, links);
}

// The reveal half of the pixel curtain: a script placed immediately after the
// <body> tag builds the full-opacity tile cover synchronously (so the cover
// paints before any content — no flash), then on DOMContentLoaded fades the
// tiles out as a downward wavefront — the EXACT per-tile recipe of the
// board's cover (curtains pixels, direction 90, noise 0.4, duration 0.5):
// each tile fades opacity over 0.5s with cubic-bezier(.76,0,.24,1), delayed
// by 0.4s × (0.6 × row fraction + 0.4 × random). Cleans the ?curtain param
// from the URL afterwards. The tint is validated hex upstream, so
// interpolating it here is safe.
export function injectReveal(html: string, tint: string): string {
  return insertAfter(html, /<body[^>]*>/i, `<script>${revealBody(`"${tint}"`)}</script>`);
}

// The same reveal, for the board itself: returning from someone's page lands on
// /?curtain=<hex>, and this runs as the first thing in <body> so the cover is
// painted before any corkboard shows. `tintExpr` is JS producing the color (or
// a falsy value, which makes the whole thing a no-op).
export const BOARD_REVEAL_SCRIPT = revealBody(
  `(function(){try{var p=new URL(location.href).searchParams.get("curtain");` +
    `return p&&/^#[0-9a-fA-F]{3,8}$/.test(p)?p:"";}catch(e){return "";}})()`,
);

function revealBody(tintExpr: string): string {
  return `(function(){
var TINT=${tintExpr};
if(!TINT)return;
var CELL=100,SPREAD=400,DUR=500,NOISE=0.4,EASE="cubic-bezier(0.76,0,0.24,1)";
var c=document.createElement("div");
c.setAttribute("aria-hidden","");
var cols=Math.ceil(innerWidth/CELL),rows=Math.ceil(innerHeight/CELL);
c.style.cssText="position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:grid;grid-template-columns:repeat("+cols+",1fr);grid-template-rows:repeat("+rows+",1fr);";
for(var r=0;r<rows;r++)for(var i=0;i<cols;i++){
  var f=(r/Math.max(1,rows-1))*(1-NOISE)+Math.random()*NOISE;
  var t=document.createElement("div");
  t.style.cssText="background:"+TINT+";margin:-0.5px;opacity:1;transition:opacity "+DUR+"ms "+EASE+" "+Math.round(SPREAD*f)+"ms;";
  c.appendChild(t);
}
document.body.appendChild(c);
function reveal(){
  void c.offsetWidth;
  for(var j=0;j<c.children.length;j++)c.children[j].style.opacity="0";
  setTimeout(function(){c.remove();},SPREAD+DUR+80);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",reveal);else reveal();
try{var u=new URL(location.href);u.searchParams.delete("curtain");history.replaceState(null,"",u.pathname+u.search+u.hash);}catch(e){}
})();`;
}

// ── The dojo runtime ─────────────────────────────────────────────────────
// A dojo doc ships only markup: the prose, and <section class="dojo-challenge">
// blocks holding starter code and tests. The editor, the syntax highlighting,
// the test runner and the recording client all live in one script the shelf
// serves and injects here.
//
// Injected rather than inlined into the doc on purpose. It's ~1,200 lines that
// would otherwise be copy-pasted into every dojo and go stale the moment the
// runtime improved; served from our own origin, one fix reaches every dojo at
// once — and the same-origin request is what lets the reader's owner cookie
// authenticate their submissions without a secret ever touching the HTML.
//
// The trade-off, accepted: a dojo saved to disk and opened as a local file is
// still readable prose, but its challenges won't run.
// Bump on every meaningful runtime change: docs are long-lived pages and a
// reader with a cached copy would otherwise keep the old editor forever.
// 2 — Monaco upgrade (real completions, hover types, type-error squiggles).
const DOJO_RUNTIME_VERSION = "2";

export function injectDojoRuntime(html: string, slug: string): string {
  const boot =
    `<script>window.__DOJO__=${JSON.stringify({ slug })};</script>` +
    `<script src="/dojo/runtime.js?v=${DOJO_RUNTIME_VERSION}" defer></script>`;
  // Into <head> so the config is set during parse and the deferred runtime is
  // queued before the challenges are reached.
  return insertAfter(html, /<head[^>]*>/i, boot);
}

// A doc that already declares an icon keeps its own.
export function hasOwnFavicon(html: string): boolean {
  return /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html);
}

export function isHexTint(tint: string | null): tint is string {
  return Boolean(tint) && /^#[0-9a-fA-F]{3,8}$/.test(tint as string);
}

function insertAfter(html: string, tag: RegExp, fragment: string): string {
  const match = html.match(tag);
  if (match && match.index !== undefined) {
    const at = match.index + match[0].length;
    return html.slice(0, at) + fragment + html.slice(at);
  }
  return fragment + html;
}
