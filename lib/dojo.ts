// The dojo's memory. A learning doc records what was WRITTEN; a dojo records
// what the learner could actually DO, and when — which is the only thing that
// tells you a skill is coming back or slipping away.
//
// Two stores, both mirroring lib/store.ts (Vercel Blob in production, .data/
// on disk locally):
//
//   dojo/<author>/ledger.json                  the skill model — per language,
//                                              per concept, with mastery + recency
//   dojo/<author>/attempts/<slug>__<challenge>__<id>.json
//                                              every single submission, code and all
//
// The attempts store is deliberately verbose: it exists so the learner's agent
// can read the exact code they wrote and coach against it, instead of asking
// them to paste it back.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ── The vocabulary ───────────────────────────────────────────────────────

export const DOJO_LANGS = ["ts", "js", "python", "rust", "go"] as const;
export type DojoLang = (typeof DOJO_LANGS)[number];

export function isDojoLang(value: string): value is DojoLang {
  return (DOJO_LANGS as readonly string[]).includes(value);
}

// The SHAPE of a challenge, not its topic. Tracked because variety is the
// whole point: a dojo that only ever asks "implement this from scratch" is
// the leetcode grind we're trying not to build. Shapes are recorded per
// attempt so the authoring agent can see what it has been over-using.
export const CHALLENGE_SHAPES = [
  "fix", // here is broken code and a failing test — find the bug
  "implement", // write the thing the module just explained
  "optimize", // it passes, now make it not embarrassing
  "refactor", // it works and reads badly — same tests, better code
  "design", // shape the API/types first, tests check the contract
  "extend", // add a capability to a system that already works
  "predict", // what does this print? (no editor, still ledgered)
] as const;
export type ChallengeShape = (typeof CHALLENGE_SHAPES)[number];

export function isChallengeShape(value: string): value is ChallengeShape {
  return (CHALLENGE_SHAPES as readonly string[]).includes(value);
}

// ── What a run produces ──────────────────────────────────────────────────

export type TestResult = {
  name: string;
  status: "pass" | "fail" | "error";
  message?: string;
};

export type RunOutcome = {
  // Did the program run at all? False for a compile error or a crash before
  // the first test — distinct from "ran and failed tests".
  ok: boolean;
  green: boolean; // every test passed, and there was at least one
  passed: number;
  total: number;
  tests: TestResult[];
  stdout: string;
  stderr: string;
  ms: number;
  where: "browser" | "sandbox";
  // Operator-facing aside shown above the results, e.g. the first Go run
  // paying for a toolchain install.
  note?: string;
};

// ── What a submission records ────────────────────────────────────────────

// Why the attempt reached us. Only "submit" moves the ledger; the rest are
// context for the coaching agent.
//   run       — pressed Run tests
//   submit    — pressed Submit (claims the challenge)
//   stuck     — pressed "save this for my agent", the hint handshake
//   reveal    — looked at the solution (recorded honestly; it costs mastery)
export type AttemptKind = "run" | "submit" | "stuck" | "reveal";

export type Attempt = {
  id: string;
  author: string;
  slug: string; // which dojo doc
  challengeId: string; // stable id within that doc
  title: string; // human name of the challenge, for the agent's benefit
  lang: DojoLang;
  skills: string[]; // concept tags this challenge exercises
  shape: ChallengeShape;
  kind: AttemptKind;
  code: string; // exactly what they wrote, verbatim
  green: boolean;
  passed: number;
  total: number;
  tests: TestResult[];
  stderr: string;
  ms: number; // execution time
  // Wall-clock time on this challenge since the first keystroke, and how many
  // times they hit Run before this attempt. Together these separate "solved it
  // cold" from "ground it out over twenty minutes".
  elapsedMs: number;
  runCount: number;
  at: string; // ISO
};

// ── The skill model ──────────────────────────────────────────────────────

export type SkillStat = {
  skill: string;
  attempts: number; // submits touching this skill
  greens: number;
  firstTryGreens: number;
  stuckCount: number;
  revealCount: number;
  challengesSeen: string[]; // "<slug>/<challengeId>"
  challengesSolved: string[];
  // Exponentially-weighted mastery over per-attempt scores, 0..1. Recent
  // performance dominates, which is what makes this usable as a progression
  // signal rather than a lifetime batting average.
  mastery: number;
  firstSeen: string;
  lastSeen: string;
};

export type LangLedger = {
  lang: DojoLang;
  attempts: number;
  greens: number;
  challengesSolved: string[];
  firstSeen: string;
  lastSeen: string;
  skills: Record<string, SkillStat>;
};

export type Ledger = {
  author: string;
  updatedAt: string;
  langs: Record<string, LangLedger>;
};

export function emptyLedger(author: string): Ledger {
  return { author, updatedAt: new Date().toISOString(), langs: {} };
}

// ── Mastery, and the rust that grows on it ───────────────────────────────

// How much a single submission is worth, 0..1. Solving cold is the only way
// to score full marks; grinding, hints, and reveals all cost — not as
// punishment, but because a skill you needed help with is not a skill you
// have back yet.
export function scoreAttempt(a: {
  green: boolean;
  passed: number;
  total: number;
  runCount: number;
  usedHint?: boolean;
  revealed?: boolean;
}): number {
  if (a.revealed) return 0.05;
  if (!a.green) {
    // Partial credit for partial passes — failing 1 of 9 is not failing 9.
    const partial = a.total > 0 ? a.passed / a.total : 0;
    return Math.min(0.3, 0.3 * partial);
  }
  // Green. First run is 1.0; each extra run before green shaves it down.
  let score = Math.max(0.4, 1 - 0.15 * Math.max(0, a.runCount - 1));
  if (a.usedHint) score *= 0.7;
  return score;
}

const EWMA_ALPHA = 0.35;

export function blendMastery(previous: number, attempts: number, score: number): number {
  if (attempts <= 0) return score;
  return previous + EWMA_ALPHA * (score - previous);
}

// The half-life of an unpracticed skill, in days. Three weeks is aggressive
// on purpose: this tool exists for someone who noticed themselves atrophying,
// and a model that lets a concept look "mastered" six months after the last
// time it was typed would be lying.
const RECALL_HALF_LIFE_DAYS = 21;

export function decayFactor(lastSeenISO: string, now = Date.now()): number {
  const days = Math.max(0, (now - Date.parse(lastSeenISO)) / 86_400_000);
  if (!Number.isFinite(days)) return 1;
  return 0.5 ** (days / RECALL_HALF_LIFE_DAYS);
}

// Mastery is what you proved. Recall is what you'd probably manage today.
export function recall(stat: SkillStat, now = Date.now()): number {
  return stat.mastery * decayFactor(stat.lastSeen, now);
}

export type SkillState = "solid" | "working" | "shaky" | "rusty";

export function skillState(stat: SkillStat, now = Date.now()): SkillState {
  const r = recall(stat, now);
  if (r >= 0.75) return "solid";
  if (r >= 0.45) return "working";
  // Below that, "how weak" is the less useful question. What a coach needs to
  // know is WHY it's weak, because the two causes want opposite responses:
  //   rusty — was genuinely solid once and has faded. Drill it; don't lecture.
  //   shaky — never actually landed, however recently it was touched. Teach it
  //           again from a different angle before testing it again.
  if (stat.mastery >= 0.6 && decayFactor(stat.lastSeen, now) < 0.7) return "rusty";
  return "shaky";
}

// What the coaching agent actually asks for: which concepts to put in front of
// the learner next. Rusty-but-once-known outranks never-attempted, because
// recovering a lapsed skill is cheaper than building a new one — and it's the
// whole premise of the dojo.
export function dueSkills(
  ledger: Ledger,
  lang?: DojoLang,
  limit = 12,
): Array<{
  lang: DojoLang;
  skill: string;
  mastery: number;
  recall: number;
  state: SkillState;
  lastSeen: string;
  attempts: number;
}> {
  const now = Date.now();
  const rows: ReturnType<typeof dueSkills> = [];

  for (const entry of Object.values(ledger.langs)) {
    if (lang && entry.lang !== lang) continue;
    for (const stat of Object.values(entry.skills)) {
      rows.push({
        lang: entry.lang,
        skill: stat.skill,
        mastery: round2(stat.mastery),
        recall: round2(recall(stat, now)),
        state: skillState(stat, now),
        lastSeen: stat.lastSeen,
        attempts: stat.attempts,
      });
    }
  }

  return rows.sort((a, b) => a.recall - b.recall).slice(0, limit);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Fold one submission into the ledger. Only "submit" attempts count toward
// mastery; "stuck" and "reveal" are recorded as costs against the skill, and
// bare "run" attempts don't touch it at all (they're the working process, and
// charging for iteration would just teach the learner to stop iterating).
export function applyAttempt(ledger: Ledger, attempt: Attempt): Ledger {
  // A bare Run never moves the model — not even lastSeen. Otherwise pressing
  // Run once after six months away would reset a concept's decay and make a
  // long-lapsed skill read as fresh, which is the exact lie this file exists
  // to avoid. Runs are still filed as attempts, for coaching.
  if (attempt.kind === "run") return ledger;

  const at = attempt.at;
  const lang = attempt.lang;
  const entry: LangLedger = ledger.langs[lang] ?? {
    lang,
    attempts: 0,
    greens: 0,
    challengesSolved: [],
    firstSeen: at,
    lastSeen: at,
    skills: {},
  };

  entry.lastSeen = at;
  const ref = `${attempt.slug}/${attempt.challengeId}`;

  if (attempt.kind === "submit") {
    entry.attempts += 1;
    if (attempt.green) {
      entry.greens += 1;
      if (!entry.challengesSolved.includes(ref)) entry.challengesSolved.push(ref);
    }
  }

  const score = scoreAttempt({
    green: attempt.green,
    passed: attempt.passed,
    total: attempt.total,
    runCount: attempt.runCount,
    revealed: attempt.kind === "reveal",
  });

  for (const skill of attempt.skills) {
    const stat: SkillStat = entry.skills[skill] ?? {
      skill,
      attempts: 0,
      greens: 0,
      firstTryGreens: 0,
      stuckCount: 0,
      revealCount: 0,
      challengesSeen: [],
      challengesSolved: [],
      mastery: 0,
      firstSeen: at,
      lastSeen: at,
    };

    if (!stat.challengesSeen.includes(ref)) stat.challengesSeen.push(ref);
    stat.lastSeen = at;

    if (attempt.kind === "stuck") {
      stat.stuckCount += 1;
    } else if (attempt.kind === "reveal") {
      stat.revealCount += 1;
      // Seeing the answer pulls mastery down toward the reveal score rather
      // than zeroing it — you did still learn something.
      stat.mastery = blendMastery(stat.mastery, stat.attempts, score);
    } else if (attempt.kind === "submit") {
      stat.mastery = blendMastery(stat.mastery, stat.attempts, score);
      stat.attempts += 1;
      if (attempt.green) {
        stat.greens += 1;
        if (attempt.runCount <= 1) stat.firstTryGreens += 1;
        if (!stat.challengesSolved.includes(ref)) stat.challengesSolved.push(ref);
      }
    }

    entry.skills[skill] = stat;
  }

  ledger.langs[lang] = entry;
  ledger.updatedAt = at;
  return ledger;
}

// ── Storage ──────────────────────────────────────────────────────────────

const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const DOJO_DIR = join(process.cwd(), ".data", "dojo");

const ledgerKey = (author: string) => `dojo/${author}/ledger.json`;
const attemptPrefix = (author: string) => `dojo/${author}/attempts/`;
const attemptKey = (a: Attempt) =>
  `${attemptPrefix(a.author)}${a.slug}__${a.challengeId}__${a.id}.json`;

export async function getLedger(author: string): Promise<Ledger> {
  if (usingBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const blob = await head(ledgerKey(author));
      const res = await fetch(blob.url, { cache: "no-store" });
      return (await res.json()) as Ledger;
    } catch {
      return emptyLedger(author);
    }
  }

  try {
    return JSON.parse(
      await readFile(join(DOJO_DIR, author, "ledger.json"), "utf-8"),
    ) as Ledger;
  } catch {
    return emptyLedger(author);
  }
}

export async function saveLedger(ledger: Ledger): Promise<void> {
  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    await put(ledgerKey(ledger.author), JSON.stringify(ledger), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }

  const dir = join(DOJO_DIR, ledger.author);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "ledger.json"), JSON.stringify(ledger), "utf-8");
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    await put(attemptKey(attempt), JSON.stringify(attempt), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }

  const dir = join(DOJO_DIR, attempt.author, "attempts");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${attempt.slug}__${attempt.challengeId}__${attempt.id}.json`),
    JSON.stringify(attempt),
    "utf-8",
  );
}

// Attempt history, newest first. Filter by doc and challenge so the coaching
// agent can pull exactly the code for the thing the learner is stuck on
// without dragging their whole history into context.
export async function listAttempts(
  author: string,
  opts: { slug?: string; challengeId?: string; limit?: number } = {},
): Promise<Attempt[]> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 20));
  // Attempt filenames start with <slug>__<challengeId>__, so the narrowest
  // known prefix does the filtering before anything gets fetched.
  const filter = opts.slug
    ? opts.challengeId
      ? `${opts.slug}__${opts.challengeId}__`
      : `${opts.slug}__`
    : "";

  let attempts: Attempt[] = [];

  if (usingBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({
      prefix: attemptPrefix(author) + filter,
      limit: 1000,
    });
    // Names end in the attempt id, which starts with an ISO timestamp, so a
    // reverse lexical sort is newest-first — and lets us fetch only the page
    // we're about to return.
    const newest = blobs
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(0, limit);
    attempts = await Promise.all(
      newest.map(async (b) => {
        const res = await fetch(b.url, { cache: "no-store" });
        return (await res.json()) as Attempt;
      }),
    );
  } else {
    try {
      const dir = join(DOJO_DIR, author, "attempts");
      const files = (await readdir(dir))
        .filter((f) => f.endsWith(".json") && f.startsWith(filter))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, limit);
      attempts = await Promise.all(
        files.map(
          async (f) =>
            JSON.parse(await readFile(join(dir, f), "utf-8")) as Attempt,
        ),
      );
    } catch {
      attempts = [];
    }
  }

  return attempts.sort((a, b) => b.at.localeCompare(a.at));
}

// Which challenges in a doc are already green — what the page needs on load
// to show its own progress without replaying the whole history client-side.
export async function solvedChallenges(
  author: string,
  slug: string,
): Promise<string[]> {
  const ledger = await getLedger(author);
  const solved = new Set<string>();
  for (const entry of Object.values(ledger.langs)) {
    for (const ref of entry.challengesSolved) {
      const [docSlug, challengeId] = splitRef(ref);
      if (docSlug === slug && challengeId) solved.add(challengeId);
    }
  }
  return [...solved];
}

function splitRef(ref: string): [string, string] {
  const slash = ref.indexOf("/");
  if (slash < 0) return [ref, ""];
  return [ref.slice(0, slash), ref.slice(slash + 1)];
}

// ── Reading a doc's shape off the doc itself ─────────────────────────────
// Measured server-side at publish time for the same reason reading time is:
// a self-reported challenge count would drift the moment a module was added,
// and the board would start lying.

const CHALLENGE_MARKER = /class=["'][^"']*\bdojo-challenge\b[^"']*["']/gi;

export function countChallenges(html: string): number {
  return (html.match(CHALLENGE_MARKER) ?? []).length;
}

export function isDojoDoc(html: string): boolean {
  return countChallenges(html) > 0;
}

export function mintAttemptId(): string {
  // Timestamp-led so lexical order is chronological order in both backends.
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
