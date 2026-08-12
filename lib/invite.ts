// Invite bundle generator: given a friend's name (and a band style), produce
// one paste-into-your-agent installer document that carries all four skills —
// the shelf contributor skill (with the secret), the learn skill (how this
// group likes to learn), the code-dojo skill (practice docs that test you),
// and the beautiful-html-templates skill. The friend
// pastes the whole thing into Claude Code OR Codex and the agent installs the
// kit for BOTH tools, so whichever one they use (now or later) knows the shelf.

import { STYLE_TOKENS } from "./styleTokens";

// Self-hosted shelves set SHELF_URL so their minted kits point at their own
// deployment; unset, this is noah's original shelf.
const SHELF_URL = process.env.SHELF_URL ?? "https://noah-learning-shelf.vercel.app";

export function buildInviteInstaller(
  rawName: string,
  style: string,
  ownerToken: string,
): string {
  const name = rawName.trim().replace(/[^a-zA-Z0-9 '-]/g, "").slice(0, 40) || "Friend";
  const author = name.toLowerCase().split(/\s+/)[0];
  const bandStyle = STYLE_TOKENS.some((b) => b.id === style) ? style : "plain";
  const secret = process.env.SHELF_SECRET ?? "MISSING_SECRET";

  return `# Welcome to The Shelf, ${name}!

Paste this ENTIRE message to your coding agent — Claude Code or Codex, either
works. The kit installs itself for BOTH tools.

---

**Agent:** ${name} has been invited to The Shelf — a corkboard website where a
group of friends pin living HTML learning docs, each written and republished by
that person's coding agent as they learn. Your job right now:

1. Create the four skill files below in BOTH tools' homes — even if only one
   of the tools is installed today, create both sets, so the other tool is
   ready the moment ${name} adopts it. Same contents at each path:
   - \`~/.claude/skills/learning-shelf/SKILL.md\` and \`~/.codex/skills/learning-shelf/SKILL.md\`
   - \`~/.claude/skills/learn/SKILL.md\` and \`~/.codex/skills/learn/SKILL.md\`
   - \`~/.claude/skills/code-dojo/SKILL.md\` and \`~/.codex/skills/code-dojo/SKILL.md\`
   - \`~/.claude/skills/beautiful-html-templates/SKILL.md\` and \`~/.codex/skills/beautiful-html-templates/SKILL.md\`
2. Add the two habit blocks (further below, after the skill files) to BOTH
   \`~/.claude/CLAUDE.md\` and \`~/.codex/AGENTS.md\` — create either file if it
   doesn't exist, and skip a block if that file already has its heading
   ("## Learning → The Shelf" / "## Practice → The Dojo"). In
   \`~/.codex/AGENTS.md\`, prepend them with this line (Codex doesn't
   auto-discover skills):
   "Skills for this live at \`~/.codex/skills/*/SKILL.md\` — read the relevant
   SKILL.md and follow it whenever a skill is named below."
   Together these are what make you proactively offer a tracked learning plan
   when ${name} wants to learn something, and a dojo when they want to get
   their coding skill back.
3. Clone the template library if it isn't already there:
   \`git clone https://github.com/zarazhangrui/beautiful-html-templates ~/beautiful-html-templates\`
4. Announce ${name} on the board — run this once, right now. It pins their
   empty corner (in their chosen design) so the group sees them before their
   first doc exists:

   \`\`\`bash
   curl -sS -X POST "${SHELF_URL}/api/join" \\
     -H "x-shelf-secret: ${secret}" \\
     -H "x-owner-token: ${ownerToken}" \\
     -F "author=${author}" \\
     -F "name=${name}" \\
     -F "style=${bandStyle}"
   \`\`\`

5. Confirm what you installed, show ${name} the board at ${SHELF_URL} —
   their corner is already pinned there — then ask what they're learning
   right now and offer to start their first doc (the learning-shelf skill
   explains the whole ritual). Mention the other kind too: a dojo, if there's
   a language they'd rather get their hands back into than read about.

──────── file: ~/.claude/skills/learning-shelf/SKILL.md AND ~/.codex/skills/learning-shelf/SKILL.md ────────

${shelfSkill(name, author, bandStyle, ownerToken)}

──────── file: ~/.claude/skills/learn/SKILL.md AND ~/.codex/skills/learn/SKILL.md ────────

${learnSkill()}

──────── file: ~/.claude/skills/code-dojo/SKILL.md AND ~/.codex/skills/code-dojo/SKILL.md ────────

${dojoSkill(name, author, bandStyle, ownerToken)}

──────── file: ~/.claude/skills/beautiful-html-templates/SKILL.md AND ~/.codex/skills/beautiful-html-templates/SKILL.md ────────

${templatesSkill()}

──────── append to ~/.claude/CLAUDE.md AND ~/.codex/AGENTS.md (skip if already present) ────────

${learningPlanRule(name, author, bandStyle)}

${practiceRule(name)}

──────── end of files ────────
`;
}

// The global habit: whenever the friend wants to learn something, their Claude
// offers to turn it into a tracked, published learning plan. Lives in
// ~/.claude/CLAUDE.md so it applies to every session.
function learningPlanRule(name: string, author: string, bandStyle: string): string {
  return `## Learning → The Shelf

${name} keeps living learning docs on The Shelf (see the \`learning-shelf\` and
\`learn\` skills). Whenever ${name} wants to learn, understand, study, or deeply
explore a topic — "teach me…", "help me understand…", "I want to learn…",
"walk me through…" — do NOT just start explaining. First offer to make it a
tracked plan:

> "Want me to turn this into a proper learning plan — pinned to The Shelf and
> updated as you go?"

If ${name} says yes:

1. **Ask which style the doc should use**, offering three choices:
   - **your usual** — the \`${bandStyle}\` template (${name}'s default look);
   - **surprise me** — pick a fitting template at random from
     \`~/beautiful-html-templates\` (read \`index.json\`, choose one whose mood
     suits the topic);
   - **or name a specific template** from the library.
2. **Plan the modules** with the \`learn\` skill — sketch the full module set,
   then generate only the first module.
3. **Build the doc** with the \`beautiful-html-templates\` skill in the chosen
   template, and **publish it** with the \`learning-shelf\` skill, filling in the
   progress fields (\`modulesTotal\`, \`modulesDone=1\`, \`currentModule\`) and
   \`author=${author}\`, \`authorStyle=${bandStyle}\`.
4. **Keep it updated**: each time a module is finished, re-publish with a bumped
   \`modulesDone\` and the next \`currentModule\`.

If ${name} says no, just teach normally — still using the \`learn\` skill's
depth-and-motivation style, just without creating a doc.`;
}

// The second habit: learning docs teach, dojos make you type. Lives beside the
// learning rule in CLAUDE.md / AGENTS.md so the distinction is made before any
// explaining starts.
function practiceRule(name: string): string {
  return `## Practice → The Dojo

Learning docs teach; **dojos make ${name} type**. Use the \`code-dojo\` skill —
not the learning-doc flow above — whenever they want to practise, drill,
sharpen, refresh, or get back a programming skill: "help me practise Rust",
"I want my TypeScript back", "drill me on Python", "my SQL is rusty",
"I've been letting AI write everything and it shows".

Two hard rules:

1. **Read their dojo ledger before proposing anything** (the \`code-dojo\` skill
   has the call). It knows which concepts are solid, which have faded, and
   which never landed — and those want different responses. Never guess their
   level or invent a starting point.
2. **When they're stuck, never ask them to paste their code.** They press "I'm
   stuck" in the doc and you read their actual attempts from the shelf. Give
   the smallest hint that unblocks, aimed at their own code.

If they ask to *learn* a language they've never used, that's a learning doc. If
they ask to get *good at it again*, that's a dojo. When it's genuinely
ambiguous, ask which they want — reading and typing are different afternoons.`;
}

function shelfSkill(
  name: string,
  author: string,
  bandStyle: string,
  ownerToken: string,
): string {
  const secret = process.env.SHELF_SECRET ?? "MISSING_SECRET";
  // their corner's dominant color — the tint the pixel curtain wears, which
  // their about page has to hand back when it links home
  const accent =
    STYLE_TOKENS.find((b) => b.id === bandStyle)?.accent ?? "#FFD43B";

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

## The three facts you need

- **Shelf URL**: \`${SHELF_URL}\`
- **Publish secret** (shared by the group): \`${secret}\`
- **${name}'s owner token** (private — proves ${name}'s corner is theirs): \`${ownerToken}\`

The secret goes in the \`x-shelf-secret\` header and the owner token in the
\`x-owner-token\` header of every publish, delete, and avatar call. The shelf
rejects writes to ${name}'s corner without the right owner token — that's
what stops anyone else on the shelf from touching ${name}'s docs, and it's
why you must never use it on any author other than \`${author}\`. Never put
either value inside an HTML doc, never commit them to a public repo.

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
4. **Make it interactive wherever interaction teaches better than prose.**
   The doc is a web page, not a PDF — use that. Docs are self-contained HTML
   with inline JS, so every module should ask: "what here would land harder
   if the reader could poke it?" Reach for things like:
   - **sliders / knobs** on any parameterized idea (change the interest rate,
     the learning rate, the glaze temperature — watch the outcome move);
   - **step-through diagrams** — a Next/Prev button that walks one state
     change at a time instead of one giant static figure;
   - **self-check reveals** — the learn skill's understanding-check questions
     as click-to-reveal cards, so the reader answers before peeking;
   - **live toggles/comparisons** — flip between the wrong way and the right
     way, before/after, naive vs. optimized;
   - **tiny sandboxes** where the topic allows (an editable input whose
     output recomputes live).
   Interactivity must serve the concept — a widget per module where it makes
   sense, not confetti everywhere. Static prose is fine for genuinely static
   ideas. All interactive bits must be styled inside the chosen template's
   design system (its colors, its fonts, its component grammar) and work
   offline in the single file — no external libraries.
5. **Every doc carries two copy buttons near the top** — "copy as HTML" and
   "copy as markdown" — small, styled in the template's design system, sitting
   with the doc's header chrome. Build them like this:
   - Keep a markdown rendition of the whole doc embedded in the file:
     \`<script type="text/markdown" id="doc-markdown"> …the doc's content as
     plain markdown… </script>\`. Update it in the SAME edit as the HTML on
     every module — it must never drift from what the page teaches.
   - "copy as HTML" copies the full living document:
     \`navigator.clipboard.writeText("<!doctype html>\\n" + document.documentElement.outerHTML)\`
   - "copy as markdown" copies the embedded block:
     \`navigator.clipboard.writeText(document.getElementById("doc-markdown").textContent.trim())\`
   - Flip the pressed button's label to "copied ✓" for a couple of seconds.
   This is what lets anyone lift a doc into their notes, a README, or another
   agent's context without scraping.
6. **Keep the local source file** in ${name}'s home or project directory. The
   shelf hosts a copy; the local file is what you edit.
7. **Republish on EVERY meaningful update** — the shelf always shows the latest.
8. **Read and iterate against the HOSTED copy** at \`${SHELF_URL}/d/<slug>\`,
   so ${name} sees exactly what everyone else sees — and click through your
   interactive bits and both copy buttons there to confirm they work as hosted.

## Publishing (and republishing — same command)

\`\`\`bash
curl -sS -X POST "${SHELF_URL}/api/publish" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}" \\
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
  -F "interests=<${name}'s living interests line — see below>" \\
  -F "html=@/absolute/path/to/your-doc.html"
\`\`\`

- \`slug\` is permanent — pick once; republishing to the same slug updates in place.
- \`subject\` and \`description\` are what the directory card shows; keep the
  description fresh as the doc evolves.
- **\`interests\`** is ${name}'s living "what I'm into" line, shown on the
  board behind the interests sticky on their paper. Send it with EVERY
  publish, freshly rewritten (never appended): one warm sentence, max ~280
  chars, that reads like a friend describing ${name} — woven from ALL the
  topics on their corner plus this doc, most-recent leanings first. Example:
  "deep in tattoo linework lately — also the person who rebuilt Next.js from
  scratch for fun." Write it yourself from what you know; don't ask ${name}
  unless they want to dictate it.
- **Progress fields** power the little progress bar on ${name}'s card. A topic
  is broken into modules (see the learn skill); \`modulesTotal\` is the planned
  count, \`modulesDone\` is how many are actually written into the doc, and
  \`currentModule\` is the one ${name} is on now. Bump \`modulesDone\` every time
  a module is finished, and re-publish. If you're not tracking modules for a
  doc, omit these three.
- The response is JSON: \`{ ok: true, url: "/d/<slug>" }\`. On error, read the
  \`error\` field. A 403 means the slug or author belongs to someone else —
  never retry with a different author name; pick a different slug instead.
- Verify after publishing: the directory at \`${SHELF_URL}/\` shows the doc
  under ${name}'s corner with a fresh date.

## Deleting a doc

Only when ${name} explicitly asks to take a doc down — deletion is permanent
(the local source file survives, so it can be republished later):

\`\`\`bash
curl -sS -X DELETE "${SHELF_URL}/api/publish?slug=<slug>" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}"
\`\`\`

This only works on ${name}'s own docs — the shelf refuses to delete anyone
else's, and you must never attempt to.

## Your polaroid (optional, once)

${name} can hang a little polaroid photo over their corner of the board. The
first time you publish for ${name} (and any time they want to change it),
offer: "want a photo on your corner? give me an image file." If they hand you
one, upload it:

\`\`\`bash
curl -sS -X POST "${SHELF_URL}/api/avatar" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}" \\
  -F "author=${author}" \\
  -F "image=@/absolute/path/to/photo.jpg"
\`\`\`

- Square-ish photos look best (it renders at 86×86); png/jpeg/webp/gif. Keep
  the upload under ~4MB — the host rejects bigger request bodies — so
  downscale big phone photos before uploading (e.g. \`sips -Z 1200 photo.jpg\`
  on macOS).
- Re-uploading replaces the old photo. It shows at \`${SHELF_URL}/a/${author}\`.
- Never upload a photo ${name} didn't explicitly choose, and never set another
  author's photo.

## Your page about yourself (optional, one per person)

Separate from the learning docs, ${name} can pin ONE page about themselves —
who they are, what they've built, what they're into, how to reach them. It
hangs off the "who is ${author}?" note on their corner and lives at
\`${SHELF_URL}/who/${author}\`.

Offer to make one when ${name} asks for a bio, an about page, a "little doc
about me", or something to hand a recruiter, a collaborator, or a new friend.
Build it exactly like a doc — one self-contained HTML file, a template from
the beautiful-html-templates skill, everything inlined — then upload:

\`\`\`bash
curl -sS -X POST "${SHELF_URL}/api/about" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}" \\
  -F "author=${author}" \\
  -F "html=@/absolute/path/to/about.html"
\`\`\`

Two rules specific to this page:

1. **It must link back to the board, near the top**, and the link must carry
   ${name}'s color so the pixel curtain plays on the way home:

   \`\`\`html
   <a href="/?curtain=${encodeURIComponent(accent)}">← back to the shelf</a>
   \`\`\`

   The \`%23\` is a literal \`#\` — written raw it would be read as a page
   anchor and the color would never arrive. Style the link inside the page's
   own design system so it looks like it belongs, not like our chrome; the
   shelf serves this page untouched and adds nothing of its own.
2. **It's a page, not a doc.** No modules, no progress bar, no copy buttons —
   those belong to learning docs. This one just says who ${name} is.

Re-uploading replaces it. To take it down:

\`\`\`bash
curl -sS -X DELETE "${SHELF_URL}/api/about?author=${author}" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}"
\`\`\`

Never write a page about someone else, and never upload one ${name} hasn't
seen.

## Browsing

The directory is \`${SHELF_URL}/\` — everyone's corners. Read others for
inspiration; never publish to someone else's slug or author name.`;
}

// The practice half of the kit. A dojo publishes through the same /api/publish
// endpoint as a learning doc — the shelf notices the challenge blocks and marks
// it — so this skill is about AUTHORING challenges and coaching against the
// ledger, not about a second publishing path.
function dojoSkill(
  name: string,
  author: string,
  bandStyle: string,
  ownerToken: string,
): string {
  const secret = process.env.SHELF_SECRET ?? "MISSING_SECRET";

  return `---
name: code-dojo
description: Build and run ${name}'s coding dojos — living HTML docs on The Shelf that teach a language and then make them actually write code in the browser, with tests, a skill ledger, and progressive difficulty. Use when ${name} wants to practise, refresh, sharpen, drill, or rebuild programming skill in a language ("get my Rust back", "I want to practise Python", "drill me on TypeScript"), when they ask for a hint on a challenge they're stuck on, or to add the next module to an existing dojo.
---

# The Dojo — ${name}'s practice skill

A learning doc teaches. A **dojo** makes them type. It is the same kind of
artifact — one self-contained HTML file, one template from
beautiful-html-templates, published to The Shelf the same way — except that
between the prose there are challenge blocks with a real editor, a real test
runner, and a ledger that remembers how they did.

**Why this exists (do not lose sight of it).** People who let AI write their
code for a year can feel the atrophy. So the dojo's job is not coverage or
completion — it is to find the specific things ${name} can no longer do cold,
and make them do them cold. Every design decision below serves that.

## Read this first, every session

Before you plan anything, ask the shelf what they can actually do today:

\`\`\`bash
curl -sS "${SHELF_URL}/api/dojo/ledger?author=${author}" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}"
\`\`\`

The \`brief\` field is written for you — read it and obey it. The rest is the
same data structured. Four states, and they want **opposite** responses:

| state | means | what you do |
|---|---|---|
| \`solid\` | proven recently | don't waste their time; use it as scaffolding for harder work |
| \`working\` | getting there | one more challenge at the same level, then raise it |
| \`rusty\` | was genuinely solid, has faded | **drill it.** Do not re-explain what they already know — that's condescending. Short challenge, straight in. |
| \`shaky\` | never actually landed | **re-teach it from a different angle**, then test. Repeating the same explanation harder does not work. |

\`due\` is ordered weakest-recall-first — that's your reading order for what to
put in front of them next. Skills decay on a 21-day half-life, so a concept
they nailed two months ago will legitimately resurface. That is the feature.

Never invent a level for them. If the ledger is empty, ask what they want to
sharpen and say plainly that you have no history yet.

## Your identity (do not change these)

- **Your human is** \`${name}\` — always publish with \`author=${author}\`.
- **Shelf URL**: \`${SHELF_URL}\`
- **Publish secret**: \`${secret}\` (\`x-shelf-secret\`)
- **${name}'s owner token**: \`${ownerToken}\` (\`x-owner-token\`)

Never put either value inside an HTML doc and never commit them. The doc needs
no secret at all — the reader's browser cookie authenticates submissions.

## Publishing a dojo

A dojo **is** a doc: publish it with the exact \`/api/publish\` call in the
\`learning-shelf\` skill, same fields, same rules (local source file, republish
on every change, both copy buttons, module progress fields). Two differences:

- The shelf detects the challenge blocks itself and marks the doc as a dojo —
  you don't send a flag. The board grows a \`⌨ dojo · N\` chip automatically.
- \`subject\` should name the craft, not the syllabus: "Rust, properly" beats
  "Rust Module 3".

Read the published copy at \`${SHELF_URL}/d/<slug>\` and **click through a
challenge yourself** — run a passing solution and a failing one — before
telling ${name} it's ready. The runtime only attaches on the hosted copy, so
opening the local file won't exercise it.

## The shape of a good dojo

**One continuous artifact, compounding.** This is the single most important
structural rule and the main thing separating a dojo from a problem set. Across
a dojo's modules ${name} should be **building one real system, one piece at a
time** — module 1's challenge produces something module 3's challenge extends.
By the end they have a working thing they'd recognise, not fourteen orphan
puzzles.

Good spines: a reactive signal graph. A retrying HTTP client with jitter and a
circuit breaker. A tiny query planner. A text diff. A router with path params.
An LRU with TTL eviction. A tokenizer, then a parser, then an evaluator. A
virtual scroller. A job queue with backpressure.

**Prose first, then the challenge.** Use the \`learn\` skill for the teaching
around each challenge: motivate the idea, explain it deeply, one concept at a
time. The challenge is where understanding gets *tested*, not where it gets
*introduced* — never ask them to write something you haven't taught in that
module.

### Banned outright

No "given an array of integers". No two-sum, no anagrams, no fizzbuzz, no
reverse-a-string, no balanced-parens-for-its-own-sake. No puzzle whose only
content is spotting a trick. Nothing that reads like interview prep. If a
challenge could appear on a competitive-programming site unchanged, delete it
and write a real one.

The test is: **would a working engineer recognise this as a thing they've
actually had to do?** If not, it's slop.

### Rotate the shapes

Declare \`data-shape\`. Blank-page implementation is the *rare* case — it's the
least informative about real skill and the most tedious:

| shape | the ask |
|---|---|
| \`fix\` | here's code and a failing test — find the bug |
| \`optimize\` | it passes; now make it not embarrassing (tests assert behaviour, brief states the bar) |
| \`refactor\` | it works and reads badly — same tests, better code |
| \`extend\` | add a capability to a system that already works |
| \`design\` | shape the API/types first; tests check the contract |
| \`predict\` | what does this print? (no editor — still ledgered) |
| \`implement\` | write it from scratch — use sparingly |

\`fix\` and \`extend\` are the highest-signal shapes for atrophy, because they're
what the job actually is. Lead with them.

### Difficulty

Aim for **solvable in one or two runs, but not zero thought**. The ledger
measures cold solves, so a challenge they grind out over ten runs teaches you
less than two challenges they get in one each. If the ledger says \`shaky\`,
make the next one *smaller*, not harder.

## The markup contract

The shelf injects the editor, highlighter, runner, and recorder. Your doc
supplies only markup. Get these attributes right — the ledger keys on them.

\`\`\`html
<section class="dojo-challenge"
         data-challenge="signal-recompute"
         data-title="Make the signal recompute"
         data-lang="ts"
         data-skills="closures,dependency-tracking"
         data-shape="fix">
  <div class="dojo-brief">
    <p>Two sentences of real stakes, then exactly what must be true when
       it passes.</p>
  </div>
  <script type="text/plain" class="dojo-starter">
    function computed(fn) {
      return { get value() { return fn() } }
    }
  </script>
  <script type="text/plain" class="dojo-tests">
    test("recomputes when a dependency changes", () => {
      const a = signal(1)
      const doubled = computed(() => a.value * 2)
      a.value = 5
      expect(doubled.value).toBe(10)
    })
  </script>
  <script type="text/plain" class="dojo-solution">
    // optional. If present, they can reveal it — and it's recorded, and it
    // costs mastery. Include one for anything genuinely hard.
  </script>
</section>
\`\`\`

- \`data-challenge\` — kebab-case, **stable forever**. Changing it orphans their
  history on that challenge. Unique within the doc.
- \`data-lang\` — \`ts\` \`js\` \`python\` \`rust\` \`go\`.
- \`data-skills\` — **the axis the entire ledger turns on.** Kebab-case, 1–3 per
  challenge, max 8. Reuse the exact names already in the ledger; do not write
  \`borrow-checker\` when \`borrowing\` is already there, or their history splits
  in half and the progression breaks. Check the ledger before inventing a name.
  Name *concepts* (\`ownership\`, \`generators\`, \`window-functions\`,
  \`error-propagation\`), never topics (\`chapter-2\`) and never languages.
- Code blocks are \`<script type="text/plain">\`, indented naturally — the
  runtime dedents. They don't count toward the doc's word count, which is
  correct: reading time should measure prose.
- Never write a closing script tag inside a code block.
- A section with neither a starter nor a tests block is left alone entirely and
  excluded from the challenge count — so a half-written challenge fails safe.
- **\`predict\` challenges** carry no editor: put the code to read in
  \`.dojo-starter\` (rendered read-only and highlighted) and the exact expected
  answer in \`.dojo-tests\`. Add \`data-choices="4|8|undefined|throws"\` to get
  radio buttons instead of a text box — better whenever the answer space is
  small, and it can't be failed on a stray space.
- \`describe()\` isn't a thing; nested groups are flattened to \`group › test\`.
  One flat list of \`test()\` calls is the intended style.

## The test API, per language

The learner's code and your test block are sandwiched with a harness that
reports results. Each language's harness is idiomatic *for that language* on
purpose — the point is rebuilding real fluency, so Rust gets \`assert_eq!\`, not
a JavaScript matcher chain.

**ts / js** — runs in their own browser, instantly and free.
\`\`\`js
test("name", () => { ... })                 // async functions work
expect(x).toBe(y) / .toEqual(y)             // toEqual is deep
expect(x).toBeCloseTo(y, digits) / .toContain(y) / .toMatch(/re/)
expect(x).toBeTruthy() / .toBeFalsy() / .toBeNull() / .toBeUndefined()
expect(x).toHaveLength(n) / expect(fn).toThrow("substring" | /re/)
expect(x).not.toBe(y)                       // .not works on all of them
assert(cond, "message")
\`\`\`

**python**
\`\`\`python
@test("name")
def _():
    expect(x).to_equal(y)      # to_be, to_be_close_to(y, digits), to_contain,
                               # to_have_length, to_be_truthy, to_be_none
    expect(fn).to_raise(ValueError, match="text")
    expect(x).not_.to_equal(y)
    assert cond, "message"     # plain assert works too
\`\`\`

**rust** — the learner's code must **not** define \`fn main\` (the harness owns it).
\`\`\`rust
dojo_case("name", || {
    assert_eq!(add(1, 2), 3);
    assert!(cond, "message");
});
\`\`\`

**go** — package-level code only; no \`func main\`.
\`\`\`go
dojoCase("name", func() {
    assertEqual(Add(1, 2), 3)      // generic over comparable
    assertTrue(cond, "message")
})
\`\`\`

### Runtime limits — design challenges inside these

- **stdlib only.** No crates, no pip installs, no npm packages. There is no
  network in the sandbox.
- \`ts\` and \`js\` run **in the reader's own browser** — a few milliseconds, free,
  no server. Keep TypeScript to **erasable syntax**: no \`enum\`, no \`namespace\`,
  no constructor parameter properties. Those still work, but they force the run
  onto the server and lose the instant feedback loop that makes drilling
  pleasant.
- **The editor type-checks; the runtime doesn't.** Monaco runs the real
  TypeScript service, so wrong types get squiggles, hovers and completions as
  they would in VS Code — but that's *advisory only* and never decides whether
  a challenge is green. At execution time types are erased, so a **test can
  never assert on a type error**. Design the tests around runtime behaviour,
  and let the squiggles teach the types.
- Rust and Go compile on the server: ~1–3s a run. Python is ~1s.
- Budgets: 4s in the browser, 10s to run and 25s to compile on the server.
  Infinite loops report as a timeout, not a crash.
- One file per challenge. There's no multi-module layout.
- Tests print pass/fail; \`console.log\`/\`print\` output survives separately and
  is shown to them, so debugging by printing works.

## Theming — the dojo must look like the doc

The injected runtime is styled **entirely** from CSS custom properties. Set
them once on \`:root\` in the doc, mapped from the template's real palette, and
the editor, buttons, results and syntax colours all land inside the template's
design system. Skip this and it will look generic — which is the failure mode
this whole project exists to avoid.

\`\`\`css
:root {
  --dojo-paper: #F0EBDE;  --dojo-ink: #23201B;   --dojo-accent: #1F2BE0;
  --dojo-muted: #6B655B;  --dojo-line: #C9C1AE;
  --dojo-pass: #1E7A44;   --dojo-fail: #B3261E;
  --dojo-code-bg: #FBF8EF; --dojo-code-ink: #23201B;
  --dojo-font-mono: 'DM Mono', ui-monospace, monospace;
  --dojo-font-body: 'Newsreader', serif;
  --dojo-radius: 2px;
  --dojo-syn-keyword: #1F2BE0; --dojo-syn-string: #1E7A44;
  --dojo-syn-comment: #8C8577; --dojo-syn-number: #A6402A;
  --dojo-syn-fn: #23201B;      --dojo-syn-type: #6B3FA0;
  --dojo-syn-punct: #6B655B;
}
\`\`\`

### Three rules the editor imposes on the doc

The challenge editor is Monaco — VS Code's editor — so the doc has to be a
good host for it:

1. **\`--dojo-font-mono\` must name a font the doc actually loads.** Monaco
   measures the font to place the caret, so a font that isn't loaded (or a bare
   \`monospace\` when the template really wanted its own mono) puts the cursor a
   few pixels off every column. Load it with the template's other fonts.
2. **Never write bare \`pre\`, \`code\`, \`span\`, or \`div\` selectors under
   \`.dojo-challenge\`.** Those rules leak into Monaco's internals and break the
   editor's layout from the outside. Style your own classes
   (\`.dojo-brief\`, and any you add) and nothing else.
3. **Don't put \`transform\`, \`filter\`, or \`will-change\` on an ancestor of a
   challenge block.** Any of them creates a containing block that breaks the
   autocomplete popup's ability to escape a scrolling container, and \`scale()\`
   also breaks click targeting inside the editor. Decorate around the
   challenges, not above them.

Pick the syntax colours **from the template's own palette** — a two-colour
template gets a two-colour highlighter with weight and italics doing the rest.
Never introduce a colour the template doesn't have — with **one** functional
exception. If the palette genuinely can't tell pass from fail (a strict
two-colour template), add a single second ink for \`--dojo-fail\`, desaturated to
sit with the palette, the way a riso print adds a second drum. Mistaking a
failure for a pass is a real cost; decorative purity isn't worth it.

If the template is dark, these values are dark; the runtime has no opinion.

## Hints — the whole point of the ledger

When ${name} says they're stuck, **do not ask them to paste their code.** They
press "I'm stuck" in the doc, which files their current draft. You read it:

\`\`\`bash
curl -sS "${SHELF_URL}/api/dojo/attempts?author=${author}&slug=<slug>&challenge=<challenge-id>" \\
  -H "x-shelf-secret: ${secret}" \\
  -H "x-owner-token: ${ownerToken}"
\`\`\`

Newest first, with the code of each attempt, which tests failed, how many runs,
and how long they've been on it. Add \`&full=1\` for every code body, drop
\`&challenge=\` for the whole doc, \`&limit=N\` to widen.

**Compare consecutive attempts.** The diff between run 3 and run 4 is where the
misunderstanding lives — that's the thing to name. Then:

1. Point at *their* code, quoting their own variable names. Never a generic
   explanation of the concept.
2. Give the **smallest** hint that unblocks: name the wrong assumption, don't
   supply the line. If they ask again, go one step further. Only write the code
   if they explicitly ask for the answer.
3. If the same misunderstanding shows up across several challenges, say so —
   that's a teaching gap in the doc, and the next module should address it
   directly.

## Keeping it going

After a session, before you re-publish:

1. Re-read the ledger — it moved.
2. Bump \`modulesDone\` / \`currentModule\` in the publish call, honestly.
3. Add the next module against what the ledger now says, not against the plan
   you made last week. If \`borrowing\` went from shaky to working, the next
   challenge should lean on it, not re-drill it.
4. Refresh \`description\` and the \`interests\` line.

Mastery is an exponentially-weighted average of recent attempts, discounted by
grinding, hints and reveals, then decayed by time. It is deliberately hard to
inflate. Never talk about it as a score to maximise — it's an instrument for
choosing what to practise, and if ${name} starts gaming it, it stops working.

## When ${name} asks to start a dojo

1. Read the ledger. Say what you see, honestly and briefly.
2. Ask what they want to sharpen and what the spine should be — offer two or
   three real systems they could build across the modules.
3. Ask about the template (their usual \`${bandStyle}\`, surprise them, or a
   named one), then follow the \`beautiful-html-templates\` skill.
4. Plan the module list, generate **only module 1** with **one or two**
   challenges, publish, and hand them the URL.
5. Wait. Don't run ahead — the next module depends on how module 1 actually
   went, and that's the whole idea.`;
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

When writing a module into the doc, plan its INTERACTIVE moment along with
its prose: the doc is a live web page, so if the module's core idea has a
parameter, a sequence, or a comparison in it, build it as something the
reader can drive (slider, step-through, toggle, click-to-reveal check) rather
than only describing it. One well-aimed interactive element per module is the
default; skip it only when the idea is genuinely static.

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
