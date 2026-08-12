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
import { isDojoDoc } from "@/lib/dojo";
import {
  hasOwnFavicon,
  injectDojoRuntime,
  injectFavicon,
  injectReveal,
  isHexTint,
} from "@/lib/reveal";
import { fallenNoteHtml } from "@/lib/fallenNote";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  let html = await getDocHtml(slug);

  if (html === undefined) {
    // A styled miss: route handlers bypass app/not-found.tsx, so serve the
    // same fallen-note look inline rather than a bare text response.
    return new Response(NOT_FOUND_HTML(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Docs that ship no favicon inherit the shelf's, so their tabs still read
  // as ours. A doc that declares any icon link keeps its own.
  if (!hasOwnFavicon(html)) {
    html = injectFavicon(html);
  }

  // A doc carrying challenges gets the editor + test runner attached.
  if (isDojoDoc(html)) {
    html = injectDojoRuntime(html, slug);
  }

  const tint = new URL(request.url).searchParams.get("curtain");
  if (isHexTint(tint)) {
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

const NOT_FOUND_HTML = () =>
  fallenNoteHtml(
    "this note fell off the board",
    "no doc lives at this slug — maybe the link is old, maybe it never existed.",
  );
