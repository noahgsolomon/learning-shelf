// Upload (or replace) the one "who I am" page pinned to a member's corner.
// Same two-layer auth as /api/publish: x-shelf-secret proves group membership,
// x-owner-token proves the corner is yours. One page per author, upserted.
//
//   curl -X POST $SHELF_URL/api/about \
//     -H "x-shelf-secret: $SECRET" -H "x-owner-token: $MY_TOKEN" \
//     -F author=noah -F html=@about-me.html

import { deleteAbout, getAboutHtml, publishAbout } from "@/lib/store";
import { ownerTokenFrom, parseOwnerCookie, verifyOwner } from "@/lib/owner";

const AUTHOR_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SHELF_SECRET;

  if (!secret) {
    return json(500, { error: "server is missing SHELF_SECRET" });
  }
  if (request.headers.get("x-shelf-secret") !== secret) {
    return json(401, { error: "bad or missing x-shelf-secret header" });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "expected multipart form data" });
  }

  const author = String(form.get("author") ?? "").toLowerCase().slice(0, 60);
  const htmlField = form.get("html");
  const html =
    htmlField instanceof File ? await htmlField.text() : String(htmlField ?? "");

  if (!AUTHOR_PATTERN.test(author)) {
    return json(400, { error: "author must match " + String(AUTHOR_PATTERN) });
  }
  if (!html.trimStart().toLowerCase().startsWith("<!doctype html")) {
    return json(400, {
      error: "html must be a complete self-contained document (<!doctype html …)",
    });
  }
  if (Buffer.byteLength(html, "utf-8") > MAX_HTML_BYTES) {
    return json(413, { error: "html exceeds 5MB" });
  }

  const owner = await verifyOwner(author, request.headers.get("x-owner-token") ?? "");
  if (!owner.ok) return json(owner.status, { error: owner.error });

  await publishAbout(author, html);

  return json(200, { ok: true, url: `/who/${author}` });
}

// Take the page down. Agents send the shared secret + owner token; a member's
// own browser can send just its owner cookie (which proves both at once).
export async function DELETE(request: Request): Promise<Response> {
  const secret = process.env.SHELF_SECRET;
  const hasSecret = Boolean(secret) && request.headers.get("x-shelf-secret") === secret;
  const hasCookie = Boolean(parseOwnerCookie(request));
  if (!hasSecret && !hasCookie) {
    return json(401, { error: "bad or missing x-shelf-secret header" });
  }

  const author = (new URL(request.url).searchParams.get("author") ?? "").toLowerCase();
  if (!AUTHOR_PATTERN.test(author)) {
    return json(400, { error: "author must match " + String(AUTHOR_PATTERN) });
  }
  if (!(await getAboutHtml(author))) {
    return json(404, { error: `no about page for "${author}"` });
  }

  const owner = await verifyOwner(author, ownerTokenFrom(request, author));
  if (!owner.ok) return json(owner.status, { error: owner.error });

  await deleteAbout(author);
  return json(200, { ok: true, deleted: author });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
