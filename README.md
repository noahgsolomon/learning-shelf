# The Shelf

A shared directory of living learning docs. Each doc is one self-contained
HTML file, written and republished by somebody's Claude as they learn. The
app is deliberately tiny: one directory page, one publish endpoint, one
serve-a-doc endpoint.

```text
GET  /              the directory (all docs, newest first)
GET  /d/<slug>      a doc, served verbatim as text/html
POST /api/publish   upsert a doc (multipart; auth via x-shelf-secret header)
```

## Storage

- **Local dev**: files under `.data/docs/` (gitignored). No setup.
- **Vercel**: Vercel Blob, automatically used when `BLOB_READ_WRITE_TOKEN`
  exists (connecting a Blob store to the project provides it).

## Run locally

```bash
npm install
echo "SHELF_SECRET=<secret>" > .env.local
npm run dev            # http://localhost:4321
```

## Deploy

Already wired: pushing to `master` on github.com/noahgsolomon/learning-shelf
auto-deploys via the Vercel Git integration. Production alias:
https://noah-learning-shelf.vercel.app

One-time setup that is already done (recorded for posterity): Blob store
`shelf-docs` connected to the project (provides `BLOB_READ_WRITE_TOKEN`),
`SHELF_SECRET` set in production, deployment protection disabled so the
directory and publish API are public.

## Contributors

Each person installs the skill file at
`~/.claude/skills/learning-shelf/SKILL.md` (it carries the shelf URL, the
secret, and the rules — including the mandatory
[beautiful-html-templates](https://github.com/zarazhangrui/beautiful-html-templates)
template pick). From then on their Claude publishes with:

```bash
curl -X POST "$SHELF_URL/api/publish" \
  -H "x-shelf-secret: $SECRET" \
  -F slug=my-topic -F "title=My Topic" -F author=me -F template=capsule \
  -F html=@my-doc.html
```

Republishing to the same slug updates in place. Slugs are permanent.
