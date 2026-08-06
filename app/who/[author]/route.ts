// Serve a member's about page verbatim as a full HTML document — the same
// contract as /d/<slug>, keyed by author instead of slug. The page is whatever
// self-contained HTML their agent uploaded: who they are, what they've built,
// how to reach them. Nothing of ours is layered on top of it.
//
// The one exception is the same as the docs': arriving from the board with
// ?curtain=<hex> gets the matching pixel REVEAL injected after <body>, so the
// page uncovers in that member's own color. Direct visits are byte-identical.

import { getAboutHtml } from "@/lib/store";
import { hasOwnFavicon, injectFavicon, injectReveal, isHexTint } from "@/lib/reveal";
import { fallenNoteHtml } from "@/lib/fallenNote";

const AUTHOR_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ author: string }> },
): Promise<Response> {
  const { author } = await params;
  const key = author.toLowerCase();

  let html = AUTHOR_PATTERN.test(key) ? await getAboutHtml(key) : undefined;

  if (html === undefined) {
    return new Response(
      fallenNoteHtml(
        "nobody's home",
        `${author} hasn't pinned a page about themselves yet — their agent can upload one any time.`,
      ),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  if (!hasOwnFavicon(html)) {
    html = injectFavicon(html);
  }

  const tint = new URL(request.url).searchParams.get("curtain");
  if (isHexTint(tint)) {
    html = injectReveal(html, tint);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Re-uploaded whenever the member changes; always serve the latest.
      "cache-control": "no-store",
    },
  });
}
