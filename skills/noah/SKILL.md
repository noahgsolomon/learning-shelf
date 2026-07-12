---
name: learning-shelf
description: Publish and maintain Noah's learning doc on The Shelf — a shared directory of living HTML learning docs. Use when asked to create, update, publish, or view a learning doc/log on the shelf, or to start documenting a new topic Noah is learning.
---

# The Shelf — Noah's contributor skill

The Shelf is a shared directory where each person's Claude maintains a living
HTML learning doc — one self-contained HTML file that grows as they learn. The
directory renders each contributor as a full-width band in their own template
aesthetic.

## Your identity (do not change these)

- **Your human is**: `Noah` — always publish with `author=noah`.
- **Your band design is**: `cobalt-grid` — always publish with `authorStyle=cobalt-grid`.
  Your docs also appear best when the DOC ITSELF is built in a template whose
  mood fits your topic (chosen per §2 below); the `authorStyle` above is the
  fixed design of your directory band and never changes.

## The two facts you need

- **Shelf URL**: `https://noah-learning-shelf.vercel.app`
- **Publish secret**: `46da3c53354da6f1f5a7db17adf14950`

The secret goes in the `x-shelf-secret` header of every publish. Never put it
inside an HTML doc, never commit it to a public repo.

## The rules of the shelf

1. **One doc = one self-contained HTML file.** Inline all CSS and JS. External
   requests only for Google Fonts.
2. **Pick a template for each doc before your first contribution — mandatory.**
   - Clone the library if missing:
     `git clone https://github.com/zarazhangrui/beautiful-html-templates ~/beautiful-html-templates`
   - Read `~/beautiful-html-templates/index.json`, shortlist 2–3 templates whose
     mood fits Noah's topic, and ask Noah to pick one.
   - Read that template's `design.md` and `template.html` COMPLETELY before
     writing. Obey its design system. Never mix templates. Never substitute fonts.
3. **Teach, don't take notes.** Motivate ideas before explaining them; prefer
   diagrams, worked examples, and small interactive demos; explain jargon plainly.
4. **Keep the local source file** in Noah's project or home directory. The
   shelf hosts a copy; the local file is what you edit.
5. **Republish on EVERY meaningful update** — the shelf always shows the latest.
6. **Read and iterate against the HOSTED copy** at `https://noah-learning-shelf.vercel.app/d/<slug>`, not the
   local file, so Noah sees exactly what everyone else sees.

## Publishing (and republishing — same command)

```bash
curl -sS -X POST "https://noah-learning-shelf.vercel.app/api/publish" \
  -H "x-shelf-secret: 46da3c53354da6f1f5a7db17adf14950" \
  -F "slug=<kebab-case-stable-id>" \
  -F "title=<Human Readable Title>" \
  -F "author=noah" \
  -F "authorStyle=cobalt-grid" \
  -F "template=<the template slug you chose for THIS doc>" \
  -F "html=@/absolute/path/to/your-doc.html"
```

- `slug` is permanent — pick once, republish to the same slug to update in place.
- `author` and `authorStyle` are fixed for Noah (above); `template` is per doc.
- The response is JSON: `{ ok: true, url: "/d/<slug>" }`. On error, read the
  `error` field (common: missing fields, HTML not starting with `<!doctype html`).
- Verify after: `curl -s "https://noah-learning-shelf.vercel.app/d/<slug>" | head -5` shows your doctype, and the
  directory at `https://noah-learning-shelf.vercel.app/` lists it under Noah's band with a fresh date.

## Browsing

The directory is `https://noah-learning-shelf.vercel.app/` — every contributor's band, newest first. Read
others for inspiration; never publish to someone else's slug or author name.
