// What the page needs the moment it loads: who's reading, may they record,
// and which challenges in this doc they've already turned green.
//
// Cookie-only and deliberately quiet — a stranger reading someone else's dojo
// gets `author: null` and a 200, not a 401. Browsing is not an error.

import { getLedger, solvedChallenges } from "@/lib/dojo";
import { json, viewerFrom } from "@/lib/dojoAuth";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!SLUG_PATTERN.test(slug)) {
    return json(400, { error: "bad slug" });
  }

  const viewer = await viewerFrom(request);
  if (!viewer.author) {
    return json(200, { author: null, canSubmit: false, solved: [], attemptsByChallenge: {} });
  }

  const [solved, ledger] = await Promise.all([
    solvedChallenges(viewer.author, slug),
    getLedger(viewer.author),
  ]);

  // A compact per-skill readout so the doc can show the reader where they
  // stand without a second request.
  const skills: Record<string, number> = {};
  for (const entry of Object.values(ledger.langs)) {
    for (const stat of Object.values(entry.skills)) {
      skills[stat.skill] = Math.round(stat.mastery * 100) / 100;
    }
  }

  return json(200, {
    author: viewer.author,
    canSubmit: true,
    solved,
    attemptsByChallenge: {},
    skills,
  });
}
