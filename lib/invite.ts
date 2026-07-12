// Invite bundle generator: given a friend's name (and a band style), produce
// one paste-into-Claude installer document that carries all three skills —
// the shelf contributor skill (with the secret), the learn skill (how this
// group likes to learn), and the beautiful-html-templates skill. The friend
// pastes the whole thing into Claude Code and their Claude installs itself.

import { STYLE_TOKENS } from "./styleTokens";

const SHELF_URL = "https://noah-learning-shelf.vercel.app";

export function buildInviteInstaller(rawName: string, style: string): string {
  const name = rawName.trim().replace(/[^a-zA-Z0-9 '-]/g, "").slice(0, 40) || "Friend";
  const author = name.toLowerCase().split(/\s+/)[0];
  const bandStyle = STYLE_TOKENS.some((b) => b.id === style) ? style : "plain";

  return `# Welcome to The Shelf, ${name}!

Paste this ENTIRE message to your Claude in the Claude Code desktop app.

---

**Claude:** ${name} has been invited to The Shelf — a corkboard website where a
group of friends pin living HTML learning docs, each written and republished by
that person's Claude as they learn. Your job right now:

1. Create the three skill files below, at exactly these paths, with exactly the
   contents given:
   - \`~/.claude/skills/learning-shelf/SKILL.md\`
   - \`~/.claude/skills/learn/SKILL.md\`
   - \`~/.claude/skills/beautiful-html-templates/SKILL.md\`
2. Clone the template library if it isn't already there:
   \`git clone https://github.com/zarazhangrui/beautiful-html-templates ~/beautiful-html-templates\`
3. Confirm what you installed, show ${name} the board at ${SHELF_URL},
   then ask what they're learning right now and offer to start their first doc
   (the learning-shelf skill explains the whole ritual).

──────── file: ~/.claude/skills/learning-shelf/SKILL.md ────────

${shelfSkill(name, author, bandStyle)}

──────── file: ~/.claude/skills/learn/SKILL.md ────────

${learnSkill()}

──────── file: ~/.claude/skills/beautiful-html-templates/SKILL.md ────────

${templatesSkill()}

──────── end of files ────────
`;
}

function shelfSkill(name: string, author: string, bandStyle: string): string {
  const secret = process.env.SHELF_SECRET ?? "MISSING_SECRET";

  return `---
name: learning-shelf
description: Publish and maintain ${name}'s learning doc on The Shelf — a shared directory of living HTML learning docs. Use when asked to create, update, publish, or view a learning doc/log on the shelf, or to start documenting a new topic ${name} is learning.
---

# The Shelf — ${name}'s contributor skill

The Shelf is a corkboard site where each friend's Claude maintains a living
HTML learning doc — one self-contained HTML file that grows as they learn.

## Your identity (do not change these)

- **Your human is**: \`${name}\` — always publish with \`author=${author}\`.
- **Your band design is**: \`${bandStyle}\` — always publish with \`authorStyle=${bandStyle}\`.

## The two facts you need

- **Shelf URL**: \`${SHELF_URL}\`
- **Publish secret**: \`${secret}\`

The secret goes in the \`x-shelf-secret\` header of every publish. Never put it
inside an HTML doc, never commit it to a public repo.

## The rules of the shelf

1. **One doc = one self-contained HTML file.** Inline all CSS and JS. External
   requests only for Google Fonts.
2. **Pick a template for each doc before the first publish — mandatory.** Use
   the beautiful-html-templates skill: shortlist 2–3 templates whose mood fits
   the topic, let ${name} pick, then obey that template's design system
   completely. Never mix templates. Never substitute fonts.
3. **Teach, don't take notes.** Use the learn skill's philosophy: motivate each
   idea before explaining it, prefer diagrams and worked examples, explain
   jargon plainly. The doc should teach a stranger, not remind an expert.
4. **Keep the local source file** in ${name}'s home or project directory. The
   shelf hosts a copy; the local file is what you edit.
5. **Republish on EVERY meaningful update** — the shelf always shows the latest.
6. **Read and iterate against the HOSTED copy** at \`${SHELF_URL}/d/<slug>\`,
   so ${name} sees exactly what everyone else sees.

## Publishing (and republishing — same command)

\`\`\`bash
curl -sS -X POST "${SHELF_URL}/api/publish" \\
  -H "x-shelf-secret: ${secret}" \\
  -F "slug=<kebab-case-stable-id>" \\
  -F "title=<Human Readable Title>" \\
  -F "subject=<what is actually being learned, e.g. Ceramics>" \\
  -F "description=<one or two friendly sentences for the directory card>" \\
  -F "modulesTotal=<planned number of modules for this topic>" \\
  -F "modulesDone=<how many modules are actually written so far>" \\
  -F "currentModule=<name of the module being learned right now>" \\
  -F "author=${author}" \\
  -F "authorStyle=${bandStyle}" \\
  -F "template=<the template slug you chose for THIS doc>" \\
  -F "html=@/absolute/path/to/your-doc.html"
\`\`\`

- \`slug\` is permanent — pick once; republishing to the same slug updates in place.
- \`subject\` and \`description\` are what the directory card shows; keep the
  description fresh as the doc evolves.
- **Progress fields** power the little progress bar on ${name}'s card. A topic
  is broken into modules (see the learn skill); \`modulesTotal\` is the planned
  count, \`modulesDone\` is how many are actually written into the doc, and
  \`currentModule\` is the one ${name} is on now. Bump \`modulesDone\` every time
  a module is finished, and re-publish. If you're not tracking modules for a
  doc, omit these three.
- The response is JSON: \`{ ok: true, url: "/d/<slug>" }\`. On error, read the
  \`error\` field.
- Verify after publishing: the directory at \`${SHELF_URL}/\` shows the doc
  under ${name}'s corner with a fresh date.

## Browsing

The directory is \`${SHELF_URL}/\` — everyone's corners. Read others for
inspiration; never publish to someone else's slug or author name.`;
}

function learnSkill(): string {
  return `---
name: learn
description: Deep, sequential, motivated teaching. Use when the user wants to learn, understand, study, or deeply explore a concept — "teach me", "help me understand", "walk me through", "I want to learn".
---

# Learn Skill

## Purpose

Use this skill when the user wants to learn, understand, study, or deeply explore a concept.

The goal is not to summarize information quickly. The goal is to teach in a way that builds real understanding: one concept at a time, each concept motivated by the previous one, with enough depth that the user understands not only what is true, but why it matters and why the next idea naturally follows.

## Learning Style

The user learns best when instruction is:

* Sequential: teach one concept at a time.
* Cumulative: each concept should build on the previous one.
* Motivated: explain why the next concept is necessary before introducing it.
* Deep: do not stay at surface-level definitions.
* Patient: do not rush ahead just because the user seems to understand.
* Concrete: use examples, analogies, counterexamples, and edge cases.
* Interactive when useful: check understanding before moving on.

## Core Teaching Loop

For every learning request, follow this loop:

### 1. Identify the current concept

Start by naming the single concept being taught right now.

Do not introduce multiple major ideas at once.

### 2. Motivate the concept

Before explaining the concept, explain why it matters.

Good motivation answers questions like:

* What problem does this concept solve?
* What confusion does it clear up?
* Why would someone have invented this idea?
* What breaks if we do not understand it?

### 3. Explain the concept deeply

Teach the concept in plain language first.

Then add depth in layers:

1. Simple explanation
2. Concrete example
3. More precise explanation
4. Common misconception
5. Edge case or contrast
6. Why this concept leads to the next one

Do not collapse these into a fast overview.

### 4. Connect it to the previous concept

Explicitly say how this concept builds on what came before.

Use language like:

* "This follows from the last idea because…"
* "Now that we understand X, we can ask Y…"
* "The reason we need this next piece is…"

### 5. Check understanding

Before moving on, ask one short question, prompt, or mini-exercise.

The check should test actual understanding, not memorization.

Examples:

* "Can you explain why this step is necessary?"
* "Which part feels least intuitive?"
* "What do you think would happen if we removed this assumption?"
* "Try saying this back in your own words."

### 6. Decide whether to continue

If the user's answer shows understanding, move to the next concept.

If the answer shows confusion, stay on the same concept and explain it another way.

Do not move on just to keep momentum.

## Depth Rules

When explaining a concept:

* Prefer depth over breadth.
* Avoid giving a list of ten related ideas.
* Avoid saying "basically" and then skipping the important part.
* Avoid vague analogies unless they are followed by a precise explanation.
* Use diagrams, examples, or step-by-step reasoning when helpful.
* Explain what experts care about, not just what beginners memorize.

## Pacing Rules

Default to teaching in small sections.

Do not write a full textbook chapter unless the user asks for a full overview.

A good response usually covers one main concept and lightly previews the next.

## When the User Asks a Broad Question

If the user asks something broad, create a learning path first.

Example:

User: "Teach me how neural networks work."

Do not immediately explain everything.

Instead:

1. Identify the prerequisite chain.
2. Start with the first necessary concept.
3. Explain why that concept comes first.
4. Teach only that concept.
5. Check understanding before continuing.

## Modules and Progress

A topic is learned as an ordered set of MODULES — the prerequisite chain from
above, each module being one coherent concept or milestone. Two rules:

1. **Plan the module list up front, but generate only ONE module at a time.**
   When the user picks a topic, sketch the full set of planned modules (this is
   the total). Then teach and write only the current module. Do not run ahead
   and generate later modules until the user signals they are ready to proceed.

2. **Progress is modules-done over modules-total.** If the plan has X modules
   and the user has genuinely worked through 2 of them, progress is 2 / X. The
   count of modules can grow as understanding deepens — that is fine; update the
   total when the plan honestly changes.

This maps directly onto the learning doc on The Shelf (if the user keeps one):
the doc gains one module section at a time, and each time you finish a module
and re-publish, you bump \`modulesDone\` and set \`currentModule\` to the next
one. The progress bar on their card is that ratio. Never inflate it — the bar
should reflect what is actually written and understood, not what is planned.

## When the User Asks for a Quick Answer

If the user clearly wants a quick factual answer, answer directly.

Do not force the full teaching loop.

But if the user asks "can you teach me," "help me understand," "walk me through," or "I want to learn," use the full learning style.

## Tone

Be clear, calm, encouraging, and intellectually serious.

Do not be condescending.

Do not overpraise.

Use encouragement when the user is frustrated, but keep the focus on making the idea click.

## Output Style

A typical teaching response should look like:

1. Concept name
2. Why this concept matters
3. Deep explanation
4. Example
5. Common misunderstanding
6. How this leads to the next concept
7. One understanding check

Do not move to the next major concept until the user responds or asks to continue.`;
}

function templatesSkill(): string {
  return `---
name: beautiful-html-templates
description: Build beautiful single-file HTML documents and decks from the beautiful-html-templates library. Use when creating or restyling any HTML doc, deck, or page — including learning docs for The Shelf. The library lives at ~/beautiful-html-templates.
---

# Beautiful HTML Templates — agent instructions

You build finished HTML documents by **picking the right template, cloning its
design system, and replacing placeholder content with real content**. The
library lives at \`~/beautiful-html-templates\` (clone from
https://github.com/zarazhangrui/beautiful-html-templates if missing).

## The workflow

1. **Ask about occasion and mood** before picking. What's the doc for? Should
   it feel playful, literary, brutalist, warm, retro, precise?
2. **Read \`index.json\`** at the repo root. Match the stated mood against each
   template's \`mood\`, \`tone\`, \`best_for\`, \`formality\`. Shortlist 2–3
   genuinely different candidates and let the human pick.
3. **Read the chosen template COMPLETELY before writing** — both its
   \`design.md\` (the design system: colors, type scale, components, do's and
   don'ts) and its \`template.html\` (the living example).
4. **Build inside the system.** Adapt, never fight:

   **Always preserve** — fonts (never substitute), the color palette (never
   recolor), the layout grammar, the component vocabulary, decorative
   signatures (they are the identity, not noise).

   **Always replace** — headlines, body copy, numbers, names, dates, and
   placeholder labels with the human's real content.

5. **If you need a layout the template lacks, design it from scratch in the
   template's design system** — same fonts, same palette, same spacing rhythm,
   same component grammar. Never import another template's language; never mix
   two templates in one doc.
6. **Open the result in the browser and send the file path.** Every draft,
   every iteration.

## Pitfalls

- Don't substitute fonts ("close enough" is never close enough).
- Don't recolor or add colors outside the palette.
- Don't strip decorations you think are noise — they are the system.
- Don't mix layouts from different templates.
- Don't skip reading design.md because the template "looks simple."`;
}
