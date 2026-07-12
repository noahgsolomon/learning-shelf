// Serve a published doc verbatim as a full HTML document. A route handler
// rather than a page on purpose: the docs are self-contained HTML files with
// their own styles and scripts, and must reach the browser untouched — not
// embedded inside someone else's React tree.

import { getDocHtml } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const html = await getDocHtml(slug);

  if (html === undefined) {
    // A styled miss: route handlers bypass app/not-found.tsx, so serve the
    // same fallen-note look inline rather than a bare text response.
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
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
