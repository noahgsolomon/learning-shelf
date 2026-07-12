// Serve a published doc verbatim as a full HTML document. A route handler
// rather than a page on purpose: the docs are self-contained HTML files with
// their own styles and scripts, and must reach the browser untouched — not
// embedded inside someone else's React tree.
//
// One deliberate exception: arriving from the board with ?curtain=<hex>
// (the pixel wipe that covered the board in that author's color) gets a
// matching pixel REVEAL injected right after <body>, so the doc uncovers
// tile by tile. Direct visits — no param — are served byte-identical.

import { getDocHtml } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  let html = await getDocHtml(slug);

  if (html === undefined) {
    // A styled miss: route handlers bypass app/not-found.tsx, so serve the
    // same fallen-note look inline rather than a bare text response.
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const tint = new URL(request.url).searchParams.get("curtain");
  if (tint && /^#[0-9a-fA-F]{3,8}$/.test(tint)) {
    html = injectReveal(html, tint);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Docs are republished on every edit; always serve the latest.
      "cache-control": "no-store",
    },
  });
}

// The reveal half of the pixel curtain: a script placed immediately after the
// <body> tag builds the full-opacity tile cover synchronously (so the cover
// paints before any content — no flash), then on DOMContentLoaded pops the
// tiles away as a downward wavefront with noise, mirroring the board's cover
// sweep. Cleans the ?curtain param from the URL afterwards. The tint is
// validated hex upstream, so interpolating it here is safe.
function injectReveal(html: string, tint: string): string {
  const script = `<script>(function(){
var CELL=100,SWEEP=380,NOISE=190;
var c=document.createElement("div");
c.setAttribute("aria-hidden","");
var cols=Math.ceil(innerWidth/CELL),rows=Math.ceil(innerHeight/CELL);
c.style.cssText="position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:grid;grid-template-columns:repeat("+cols+",1fr);grid-template-rows:repeat("+rows+",1fr);";
var tiles=[];
for(var r=0;r<rows;r++)for(var i=0;i<cols;i++){var t=document.createElement("div");t.style.cssText="background:${tint};margin:-0.5px;";c.appendChild(t);tiles.push([t,(r/Math.max(1,rows-1))*SWEEP+Math.random()*NOISE]);}
document.body.appendChild(c);
function reveal(){
  for(var j=0;j<tiles.length;j++)(function(t,d){setTimeout(function(){t.style.opacity="0";},d);})(tiles[j][0],tiles[j][1]);
  setTimeout(function(){c.remove();},SWEEP+NOISE+80);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",reveal);else reveal();
try{var u=new URL(location.href);u.searchParams.delete("curtain");history.replaceState(null,"",u.pathname+u.search+u.hash);}catch(e){}
})();</script>`;

  const bodyTag = html.match(/<body[^>]*>/i);
  if (bodyTag && bodyTag.index !== undefined) {
    const at = bodyTag.index + bodyTag[0].length;
    return html.slice(0, at) + script + html.slice(at);
  }
  return script + html;
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · Learning Shelf</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Shrikhand&family=Zilla+Slab&display=block" rel="stylesheet">
<style>
  html { background: #A9855B; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(ellipse at 30% 0%, rgba(255,240,205,0.30), transparent 60%),
                linear-gradient(160deg, #BC9A6C 0%, #A9855B 55%, #9C7950 100%);
    color: #2D2A26; text-align: center; padding: 24px;
  }
  h1 {
    margin: 0; font-family: 'Shrikhand', cursive; font-weight: 400;
    font-size: clamp(56px, 12vw, 110px); line-height: 1; color: #FBF7EE;
    text-shadow: 4px 4px 0 rgba(45,42,38,0.45); transform: rotate(-1.5deg);
  }
  .note {
    position: relative; display: inline-block; margin-top: 34px; max-width: 340px;
    background: linear-gradient(180deg, #FFE066 0%, #FFD43B 100%);
    padding: 26px 30px 30px; transform: rotate(1.6deg);
    box-shadow: 2px 3px 15px rgba(45,42,38,0.22), 0 1px 3px rgba(45,42,38,0.28);
  }
  .note .pin {
    position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
    width: 16px; height: 16px; border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a);
    box-shadow: 0 2px 4px rgba(45,42,38,0.5), inset -2px -2px 4px rgba(0,0,0,0.2);
  }
  .note p:first-of-type { margin: 0; font-family: 'Caveat', cursive; font-weight: 700; font-size: 28px; line-height: 1.15; }
  .note p:last-of-type { margin: 10px 0 0; font-family: 'Zilla Slab', serif; font-size: 16px; line-height: 1.5; }
  a { display: inline-block; margin-top: 30px; font-family: 'Caveat', cursive; font-weight: 700; font-size: 24px; color: #3B2F21; text-decoration: none; }
</style>
</head>
<body>
<div>
  <h1>404</h1>
  <div class="note">
    <span class="pin"></span>
    <p>this note fell off the board</p>
    <p>no doc lives at this slug — maybe the link is old, maybe it never existed.</p>
  </div>
  <div><a href="/">&larr; back to the board</a></div>
</div>
</body>
</html>`;
