// Record an attempt: the code, the results, and what it cost.
//
// Attempts are filed under the VIEWER, not the doc's author. A dojo is shared
// curriculum — if a friend works through Noah's Rust dojo, the challenges are
// his and the ledger entries are theirs. That falls out of the cookie: whoever
// the browser proves you are is whose skill model moves.
//
// Every Run press lands here too, not just Submit. That's deliberate and it's
// the whole hint mechanism: the learner's agent can read the exact code they
// were staring at when they got stuck, instead of asking them to paste it.

import {
  applyAttempt,
  getLedger,
  isChallengeShape,
  isDojoLang,
  mintAttemptId,
  recall,
  saveAttempt,
  saveLedger,
  skillState,
  type Attempt,
  type AttemptKind,
  type TestResult,
} from "@/lib/dojo";
import { agentAuthorized, json, viewerFrom } from "@/lib/dojoAuth";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const KINDS: AttemptKind[] = ["run", "submit", "stuck", "reveal"];
const MAX_CODE_CHARS = 60_000;
const MAX_SKILLS = 8;

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "expected a JSON body" });
  }

  const slug = String(body.slug ?? "");
  const challengeId = String(body.challengeId ?? "");
  const lang = String(body.lang ?? "");
  const shape = String(body.shape ?? "implement");
  const kind = String(body.kind ?? "run") as AttemptKind;

  if (!SLUG_PATTERN.test(slug)) return json(400, { error: "bad slug" });
  if (!ID_PATTERN.test(challengeId)) return json(400, { error: "bad challengeId" });
  if (!isDojoLang(lang)) return json(400, { error: `unknown language "${lang}"` });
  if (!isChallengeShape(shape)) return json(400, { error: `unknown shape "${shape}"` });
  if (!KINDS.includes(kind)) return json(400, { error: `unknown kind "${kind}"` });

  const code = String(body.code ?? "");
  if (code.length > MAX_CODE_CHARS) {
    return json(413, { error: "that's more code than we'll store" });
  }

  // Skills are the axis the whole ledger turns on, so they're normalised hard:
  // lowercase kebab, deduped, capped. A doc that spells a concept two ways
  // would otherwise split its own history in half.
  const skills = [
    ...new Set(
      asArray(body.skills)
        .map((s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean),
    ),
  ].slice(0, MAX_SKILLS);

  if (skills.length === 0) {
    return json(400, { error: "every challenge must declare at least one skill" });
  }

  // Who is this? The browser's cookie, or an agent naming an author outright.
  let author: string | null = null;
  const claimed = String(body.author ?? "").toLowerCase();
  if (request.headers.get("x-shelf-secret") && claimed) {
    const agent = await agentAuthorized(request, claimed);
    if (!agent.ok) return json(agent.status, { error: agent.error });
    author = claimed;
  } else {
    const viewer = await viewerFrom(request);
    author = viewer.author;
  }

  if (!author) {
    // Not an error the reader needs to fix — they're just browsing.
    return json(200, {
      ok: true,
      recorded: false,
      reason: "no member cookie — nothing recorded",
    });
  }

  const outcome = (body.outcome ?? {}) as Record<string, unknown>;
  const tests = asArray(outcome.tests)
    .slice(0, 200)
    .map((t): TestResult => {
      const row = (t ?? {}) as Record<string, unknown>;
      const status = String(row.status ?? "fail");
      return {
        name: String(row.name ?? "unnamed test").slice(0, 200),
        status: status === "pass" ? "pass" : status === "error" ? "error" : "fail",
        message: row.message ? String(row.message).slice(0, 2_000) : undefined,
      };
    });

  const passed = tests.filter((t) => t.status === "pass").length;
  const total = tests.length;

  const attempt: Attempt = {
    id: mintAttemptId(),
    author,
    slug,
    challengeId,
    title: String(body.title ?? challengeId).slice(0, 160),
    lang,
    skills,
    shape,
    kind,
    code,
    // Trust the client for the tests it ran, but never for "I passed": green
    // is derived from the results themselves.
    green: total > 0 && passed === total,
    passed,
    total,
    tests,
    stderr: String(outcome.stderr ?? "").slice(0, 8_000),
    ms: clampInt(outcome.ms, 0, 600_000),
    elapsedMs: clampInt(body.elapsedMs, 0, 24 * 3_600_000),
    runCount: clampInt(body.runCount, 0, 9_999),
    at: new Date().toISOString(),
  };

  await saveAttempt(attempt);

  // Bare runs are the working process; charging mastery for iterating would
  // just teach the learner to stop iterating. They're kept for coaching only.
  if (kind === "run") {
    return json(200, { ok: true, recorded: true, ledgerMoved: false });
  }

  const ledger = applyAttempt(await getLedger(author), attempt);
  await saveLedger(ledger);

  const entry = ledger.langs[lang];
  return json(200, {
    ok: true,
    recorded: true,
    ledgerMoved: true,
    skills: skills.map((skill) => {
      const stat = entry?.skills[skill];
      return stat
        ? {
            skill,
            mastery: Math.round(stat.mastery * 100) / 100,
            recall: Math.round(recall(stat) * 100) / 100,
            state: skillState(stat),
          }
        : { skill, mastery: 0, recall: 0, state: "rusty" as const };
    }),
  });
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function clampInt(value: unknown, lo: number, hi: number): number {
  const n = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
