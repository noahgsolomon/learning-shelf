// The code itself — every version of it.
//
// This exists so that "I'm stuck, give me a hint" needs no copy-paste. The
// learner presses a button in the doc, their agent reads this endpoint, and
// the hint is about the code they actually wrote: the variable they shadowed,
// the base case they forgot, the same off-by-one they made on attempt 2 and
// again on attempt 5.
//
//   GET /api/dojo/attempts?author=noah                       last 20, any doc
//   GET /api/dojo/attempts?author=noah&slug=rust-ownership    one dojo
//   GET /api/dojo/attempts?author=noah&slug=…&challenge=…     one challenge
//   …&full=1                                                  include every code body

import { listAttempts } from "@/lib/dojo";
import { json, readerFor } from "@/lib/dojoAuth";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requested = params.get("author") ?? "";
  if (!requested) {
    return json(400, { error: "which author? pass ?author=<name>" });
  }

  const access = await readerFor(request, requested);
  if (!access.ok) return json(access.status, { error: access.error });

  const slug = params.get("slug") ?? "";
  const challengeId = params.get("challenge") ?? "";
  if (slug && !SLUG_PATTERN.test(slug)) return json(400, { error: "bad slug" });
  if (challengeId && !ID_PATTERN.test(challengeId)) {
    return json(400, { error: "bad challenge id" });
  }
  if (challengeId && !slug) {
    return json(400, { error: "a challenge id needs its slug too" });
  }

  const limit = Math.max(1, Math.min(100, Number(params.get("limit") ?? 20) || 20));
  // Code bodies are the point, but twenty of them is a lot of context — so the
  // full history is opt-in, and by default only the newest few carry code.
  const full = params.get("full") === "1";
  const CODE_BODIES = 6;

  const attempts = await listAttempts(access.author, { slug, challengeId, limit });

  return json(200, {
    author: access.author,
    count: attempts.length,
    attempts: attempts.map((a, i) => ({
      id: a.id,
      at: a.at,
      slug: a.slug,
      challengeId: a.challengeId,
      title: a.title,
      lang: a.lang,
      shape: a.shape,
      skills: a.skills,
      kind: a.kind,
      green: a.green,
      passed: a.passed,
      total: a.total,
      runCount: a.runCount,
      minutesOnChallenge: Math.round(a.elapsedMs / 60_000),
      failing: a.tests
        .filter((t) => t.status !== "pass")
        .map((t) => ({ name: t.name, message: t.message })),
      stderr: a.stderr || undefined,
      code: full || i < CODE_BODIES ? a.code : undefined,
      codeOmitted: full || i < CODE_BODIES ? undefined : "pass full=1 to include",
    })),
    hint:
      attempts.length === 0
        ? "no attempts recorded for that filter yet"
        : "newest first. compare consecutive `code` bodies to see what they changed between runs — that's usually where the misunderstanding is.",
  });
}
