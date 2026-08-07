// The board's directory data, as JSON. Everything here already renders on the
// public board — this just makes it readable by something other than a browser,
// so a member's own page (or their agent) can list what they're learning
// without scraping the corkboard.
//
// Read-only and unauthenticated on purpose. Writes still go through
// /api/publish with the shelf secret and an owner token.
//
//   GET /api/docs              → every doc on the shelf
//   GET /api/docs?author=noah  → just that corner's

import { listDocs } from "@/lib/store";
import { depthIndex, DEPTH_LEVELS } from "@/lib/readtime";

const AUTHOR_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function GET(request: Request): Promise<Response> {
  const author = (new URL(request.url).searchParams.get("author") ?? "").toLowerCase();

  if (author && !AUTHOR_PATTERN.test(author)) {
    return json(400, { error: "author must match " + String(AUTHOR_PATTERN) });
  }

  let docs = await listDocs();
  if (author) {
    docs = docs.filter((d) => d.author.toLowerCase() === author);
  }

  return json(200, {
    docs: docs.map((d) => {
      const depth = DEPTH_LEVELS[depthIndex(d.wordCount)];
      return {
        slug: d.slug,
        url: `/d/${d.slug}`,
        title: d.title,
        subject: d.subject,
        description: d.description,
        author: d.author,
        modulesDone: d.modulesDone,
        modulesTotal: d.modulesTotal,
        currentModule: d.currentModule,
        readMinutes: d.readMinutes,
        wordCount: d.wordCount,
        depth: depth.label,
        depthEmoji: depth.emoji,
        updatedAt: d.updatedAt,
      };
    }),
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // docs are republished constantly; never hand back a stale directory
      "cache-control": "no-store",
      // a member's page may be opened as a local file, so let it read this
      "access-control-allow-origin": "*",
    },
  });
}
