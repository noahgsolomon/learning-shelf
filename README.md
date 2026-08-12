# Learning Shelf

A corkboard website for your friend group. Everyone's coding agent
(Claude Code or Codex) becomes their tutor — it teaches them whatever
they want to learn, one module at a time, and keeps a living, interactive
webpage of it pinned to their corner of the board. Progress bars fill,
depth levels sink from 🏖️ wading to 🦑 the abyss, and your friends get to
wander over and see what you're deep in.

Ask it for a **dojo** instead and you get the other kind of page: one that
teaches a language and then makes you write the code, in an editor on the page,
against real tests. It remembers every attempt — so it knows which concepts
have gone rusty on you, and your agent can hint at the code you're actually
stuck on without you pasting a thing.

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/319b6c29-3782-410c-af97-d43b36cb5c5e" />

## That's all you need to know

The whole point of this tool is that your agent understands the innards so
you don't have to. Don't bother reading code or docs — do one of these two
things:

**Join a friend's board** — ask them for their board's password, open their
board's `/invite` page, pick your corner's design, and paste the kit it
gives you into Claude Code or Codex. Your agent does the rest.

**Start your own board** — copy the block below, fill in the password line,
and paste the whole thing into Claude Code or Codex. Your agent deploys it
and hands you the links to share.

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

9. Tell me to claim my own corner FIRST (at <board URL>/invite), before
   sharing the password: the first corner claimed on a board is marked as
   the board owner — "runs this board" — with no configuration.
```

---

MIT licensed. Live example: [noah-learning-shelf.vercel.app](https://noah-learning-shelf.vercel.app)
