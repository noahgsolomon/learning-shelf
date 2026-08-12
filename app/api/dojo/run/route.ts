// Execute a challenge's code and report which tests passed.
//
// Only the languages the browser can't handle reach this route — js and ts run
// in a Web Worker in the reader's own tab, and only fall back here when the
// type stripper can't parse what they wrote. Running requires shelf
// membership (see lib/dojoAuth.ts for why), and nothing here is recorded:
// the page reports the attempt separately via /api/dojo/submit, so a run that
// crashes the runner never silently costs the learner mastery.

import { isDojoLang } from "@/lib/dojo";
import { json, rateLimit, viewerFrom } from "@/lib/dojoAuth";
import { runOnServer } from "@/lib/dojoRunner";

export const runtime = "nodejs";
// Comfortably above the runner's own build + run budget, so a slow first
// compile reports a real result instead of the function dying underneath it.
export const maxDuration = 60;

const MAX_CODE_CHARS = 60_000;

export async function POST(request: Request): Promise<Response> {
  let body: {
    lang?: string;
    code?: string;
    tests?: string;
    slug?: string;
    challengeId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "expected a JSON body" });
  }

  const lang = String(body.lang ?? "");
  if (!isDojoLang(lang)) {
    return json(400, { error: `unknown language "${lang}"` });
  }

  const code = String(body.code ?? "");
  const tests = String(body.tests ?? "");
  if (!tests.trim()) {
    return json(400, { error: "this challenge has no tests to run" });
  }
  if (code.length > MAX_CODE_CHARS || tests.length > MAX_CODE_CHARS) {
    return json(413, { error: "that's more code than the runner accepts" });
  }

  // Membership, not ownership: friends may try each other's dojos.
  const viewer = await viewerFrom(request);
  const secretOk =
    Boolean(process.env.SHELF_SECRET) &&
    request.headers.get("x-shelf-secret") === process.env.SHELF_SECRET;

  if (!viewer.author && !secretOk) {
    return json(403, {
      error:
        "only shelf members can run code here — join the board and your browser will be recognised",
    });
  }

  const limit = rateLimit(`run:${viewer.author ?? "agent"}`);
  if (!limit.ok) {
    return json(
      429,
      { error: "easy — that's a lot of runs in a short window. try again shortly." },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  const outcome = await runOnServer(lang, code, tests);
  return json(200, outcome);
}
