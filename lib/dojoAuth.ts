// Who is allowed to do what in the dojo.
//
// Two doors, mirroring the rest of the shelf:
//
//   THE BROWSER — a member reading their own dojo. Their httpOnly owner
//   cookie (set when their kit was minted) proves who they are, so nothing
//   secret ever has to live inside the published HTML.
//
//   THE AGENT — their coding agent, holding the shelf secret and their owner
//   token in headers, reading the ledger to coach them.
//
// Running code is gated on being a MEMBER, not on owning the doc. Anyone can
// read a friend's dojo, but executing code is a real resource on someone
// else's infrastructure, and the invite password is the group's trust
// boundary — so a stranger reads, a friend runs, and only the owner records.

import { parseOwnerCookie, verifyOwner } from "./owner";

export type Viewer = {
  // The signed-in member, if the cookie checks out.
  author: string | null;
};

export async function viewerFrom(request: Request): Promise<Viewer> {
  const cookie = parseOwnerCookie(request);
  if (!cookie) return { author: null };
  const owner = await verifyOwner(cookie.author, cookie.token);
  return { author: owner.ok ? cookie.author.toLowerCase() : null };
}

// An agent call: the group secret AND the author's own owner token. Same
// contract as publishing, so the kit already has everything it needs.
export async function agentAuthorized(
  request: Request,
  author: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = process.env.SHELF_SECRET;
  if (!secret) {
    return { ok: false, status: 500, error: "server is missing SHELF_SECRET" };
  }
  if (request.headers.get("x-shelf-secret") !== secret) {
    return { ok: false, status: 401, error: "bad or missing x-shelf-secret header" };
  }
  const owner = await verifyOwner(author, request.headers.get("x-owner-token") ?? "");
  if (!owner.ok) return owner;
  return { ok: true };
}

// Either door, for the read routes: an agent with headers, or the member's
// own browser. Returns the author whose data may be read.
export async function readerFor(
  request: Request,
  requested: string,
): Promise<{ ok: true; author: string } | { ok: false; status: number; error: string }> {
  const author = requested.toLowerCase();

  if (request.headers.get("x-shelf-secret")) {
    const agent = await agentAuthorized(request, author);
    return agent.ok ? { ok: true, author } : agent;
  }

  const viewer = await viewerFrom(request);
  if (viewer.author && viewer.author === author) {
    return { ok: true, author };
  }
  return {
    ok: false,
    status: 401,
    error:
      "dojo history is private — call this with x-shelf-secret and x-owner-token, or from the browser that claimed this corner",
  };
}

// ── Rate limiting ────────────────────────────────────────────────────────
// A sliding window per member, in memory. This is per-instance and therefore
// approximate — it's a courtesy brake on runaway loops and accidental
// hammering, not a security control. The real control is that running
// requires membership at all.

const WINDOW_MS = 10 * 60_000;
const MAX_RUNS_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

export function rateLimit(key: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_RUNS_PER_WINDOW) {
    const oldest = recent[0];
    hits.set(key, recent);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

export function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}
