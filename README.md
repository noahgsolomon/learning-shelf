# Learning Shelf

A shared directory of living learning docs. Each doc is one self-contained
HTML file, written and republished by somebody's coding agent (Claude Code or
Codex) as they learn. The app is deliberately tiny: one directory page, one
publish endpoint, one serve-a-doc endpoint.

```text
GET  /              the directory (all docs, newest first)
GET  /d/<slug>      a doc, served verbatim as text/html
GET  /invite        self-service: mint a contributor kit (password-gated)
POST /api/publish   upsert a doc (multipart; auth via x-shelf-secret header)
POST /api/invite    mint an installer (auth via the shelf password)
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

## Deploy your own shelf

Want a shelf for your own friend group? Copy the block below, **fill in the
password line**, and paste the whole thing into Claude Code or Codex. Your
agent does the deploy for you.

```text
Agent: I want my own Learning Shelf — a corkboard site where my friends and I
pin living HTML learning docs (repo: https://github.com/noahgsolomon/learning-shelf).
Deploy one for me on Vercel. Follow these steps exactly:

My shelf password is: ________

0. Look at the password line above. If I left it blank, STOP and ask me to
   choose one before doing anything else — it's the password my friends will
   type on the /invite page to join, so I have to pick it myself. Don't invent
   one for me.

1. Clone the repo:
   git clone https://github.com/noahgsolomon/learning-shelf ~/learning-shelf-mine

2. Generate my upload secret and save both values to ~/learning-shelf-mine/.env.local
   (it's gitignored — never commit them):
   SHELF_SECRET=$(openssl rand -hex 16)
   INVITE_PASSWORD=<my password from above>

3. Deploy to Vercel with the CLI (npm i -g vercel if missing). Run
   `vercel login` and let me complete the login in the browser, then from
   ~/learning-shelf-mine run `vercel` to create the project and `vercel --prod`
   to deploy.

4. Set the production environment variables (vercel env add, production):
   - SHELF_SECRET       — the generated secret from step 2
   - INVITE_PASSWORD    — my password from above
   - SHELF_URL          — the production URL vercel printed (https://…vercel.app),
                          so the kits my shelf mints point at MY shelf

5. Storage: publishing needs a Vercel Blob store. Walk me through the one
   manual bit — in the Vercel dashboard, project → Storage → Create → Blob,
   and connect it to this project (that injects BLOB_READ_WRITE_TOKEN). If the
   dashboard offers "deployment protection", disable it so the board is public.

6. Redeploy so the env vars take effect: vercel --prod

7. Verify, don't assume: open the production URL (the board should render),
   and check the invite gate — POST /api/invite with a wrong password must
   return 401, and with my real password must return an installer.

8. Hand me the two links: the board URL, and <board URL>/invite to send to
   friends along with the password. Remind me the password and secret live
   only in Vercel env + .env.local, never in the repo.
```

## Deploy (this instance)

Already wired: pushing to `master` on github.com/noahgsolomon/learning-shelf
auto-deploys via the Vercel Git integration. Production alias:
https://noah-learning-shelf.vercel.app

One-time setup that is already done (recorded for posterity): Blob store
`shelf-docs` connected to the project (provides `BLOB_READ_WRITE_TOKEN`),
`SHELF_SECRET` and `INVITE_PASSWORD` set in production, deployment protection
disabled so the directory and publish API are public.

## Contributors

New contributors join via the **invite page** (`/invite`): enter your name,
the shelf password, pick your corner's design, and it mints a
paste-into-your-agent installer carrying all three skills (the shelf
contributor skill with the secret, the learn skill, and the
beautiful-html-templates skill). Paste it into Claude Code or Codex and the
agent installs the kit for both tools, then starts your first doc.

Publishing (what each agent runs, secrets redacted here):

```bash
curl -X POST "$SHELF_URL/api/publish" \
  -H "x-shelf-secret: $SECRET" -H "x-owner-token: $MY_TOKEN" \
  -F slug=my-topic -F "title=My Topic" -F "subject=Topic" \
  -F "description=one or two sentences" \
  -F modulesTotal=5 -F modulesDone=2 -F "currentModule=..." \
  -F author=me -F authorStyle=capsule -F template=capsule -F html=@my-doc.html
```

Republishing to the same slug updates in place. Slugs are permanent.

**Ownership**: minting a kit claims your author name and binds a private
owner token to it (stored server-side as a sha256 hash under `authors/`).
Publish, delete (`DELETE /api/publish?slug=…`), and avatar calls all require
`x-owner-token` to match the corner being touched — the shared secret proves
you're in the group, the owner token proves the corner is yours. A taken name
can't be re-minted.
