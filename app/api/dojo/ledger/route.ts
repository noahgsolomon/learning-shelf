// The skill model, for the coach.
//
// This is the endpoint the learner's agent reads before deciding what to teach
// next. It answers one question — what can this person actually do today? —
// and it answers it in two forms: structured numbers, and a plain-language
// brief the agent can act on without doing arithmetic in its head.

import {
  DOJO_LANGS,
  decayFactor,
  dueSkills,
  getLedger,
  isDojoLang,
  recall,
  skillState,
  type DojoLang,
} from "@/lib/dojo";
import { json, readerFor } from "@/lib/dojoAuth";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requested = params.get("author") ?? "";
  if (!requested) {
    return json(400, { error: "which author? pass ?author=<name>" });
  }

  const access = await readerFor(request, requested);
  if (!access.ok) return json(access.status, { error: access.error });

  const langFilter = params.get("lang") ?? "";
  if (langFilter && !isDojoLang(langFilter)) {
    return json(400, {
      error: `unknown language "${langFilter}" — one of ${DOJO_LANGS.join(", ")}`,
    });
  }

  const ledger = await getLedger(access.author);
  const now = Date.now();

  const langs = Object.values(ledger.langs)
    .filter((entry) => !langFilter || entry.lang === langFilter)
    .map((entry) => {
      const skills = Object.values(entry.skills)
        .map((stat) => ({
          skill: stat.skill,
          state: skillState(stat, now),
          mastery: round2(stat.mastery),
          recall: round2(recall(stat, now)),
          attempts: stat.attempts,
          greens: stat.greens,
          firstTryGreens: stat.firstTryGreens,
          stuckCount: stat.stuckCount,
          revealCount: stat.revealCount,
          solved: stat.challengesSolved.length,
          seen: stat.challengesSeen.length,
          lastSeen: stat.lastSeen,
          daysSince: daysSince(stat.lastSeen, now),
        }))
        .sort((a, b) => a.recall - b.recall);

      return {
        lang: entry.lang,
        attempts: entry.attempts,
        greens: entry.greens,
        solvedChallenges: entry.challengesSolved.length,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        daysSince: daysSince(entry.lastSeen, now),
        // How much of what they proved would survive today, averaged. The one
        // number that answers "am I actually getting sharper?"
        retention: round2(
          average(Object.values(entry.skills).map((s) => decayFactor(s.lastSeen, now))),
        ),
        skills,
      };
    })
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  const due = dueSkills(ledger, langFilter ? (langFilter as DojoLang) : undefined, 12);

  return json(200, {
    author: access.author,
    updatedAt: ledger.updatedAt,
    langs,
    // Ordered worst-recall first: the reading order for planning the next
    // module, since a lapsed skill is cheaper to recover than a new one.
    due,
    brief: brief(access.author, langs, due),
  });
}

type LangView = {
  lang: string;
  attempts: number;
  greens: number;
  solvedChallenges: number;
  daysSince: number;
  retention: number;
  skills: Array<{ skill: string; state: string; mastery: number; recall: number; daysSince: number; firstTryGreens: number; attempts: number; stuckCount: number }>;
};

// A few sentences an agent can read instead of interpreting the numbers. Kept
// honest: it says "no history yet" rather than inventing encouragement.
function brief(
  author: string,
  langs: LangView[],
  due: ReturnType<typeof dueSkills>,
): string {
  if (langs.length === 0) {
    return `${author} has no dojo history yet — nothing has been attempted, so start by asking what they want to sharpen and pitch a first module rather than assuming a level.`;
  }

  const lines: string[] = [];

  for (const lang of langs) {
    const solid = lang.skills.filter((s) => s.state === "solid").map((s) => s.skill);
    const rusty = lang.skills.filter((s) => s.state === "rusty");
    const shaky = lang.skills.filter((s) => s.state === "shaky");
    const parts = [
      `${lang.lang}: ${lang.greens} of ${lang.attempts} submissions green across ${lang.solvedChallenges} challenges`,
      lang.daysSince > 0 ? `last practised ${lang.daysSince}d ago` : "practised today",
      `retention ${Math.round(lang.retention * 100)}%`,
    ];
    lines.push(parts.join(", ") + ".");
    if (solid.length) lines.push(`  solid: ${solid.join(", ")}.`);
    // The two kinds of weak want opposite responses, so they're named
    // separately and told apart in words the coach can act on directly.
    if (rusty.length) {
      lines.push(
        `  rusty — knew these once, they've faded, so DRILL them rather than re-explaining: ${rusty
          .map((s) => `${s.skill} (${s.daysSince}d ago)`)
          .join(", ")}.`,
      );
    }
    if (shaky.length) {
      lines.push(
        `  shaky — never actually landed, so RE-TEACH from a different angle before testing again: ${shaky
          .map((s) => s.skill)
          .join(", ")}.`,
      );
    }
    const grindy = lang.skills.filter((s) => s.attempts >= 2 && s.firstTryGreens === 0);
    if (grindy.length) {
      lines.push(
        `  never solved cold (always needed multiple runs): ${grindy.map((s) => s.skill).join(", ")}.`,
      );
    }
  }

  if (due.length) {
    lines.push(
      `Due next, weakest first: ${due
        .slice(0, 6)
        .map((d) => `${d.skill} (${d.lang}, ${d.state})`)
        .join(", ")}.`,
    );
  }

  return lines.join("\n");
}

function daysSince(iso: string, now: number): number {
  return Math.floor(Math.max(0, (now - Date.parse(iso)) / 86_400_000));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
