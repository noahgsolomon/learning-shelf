// The entire write surface of the shelf: one endpoint, shared-secret auth,
// upsert-by-slug. Claudes re-POST the whole HTML file on every update.
//
//   curl -X POST $SHELF_URL/api/publish \
//     -H "x-shelf-secret: $SECRET" \
//     -F slug=softshell-log -F title="The Softshell Log" \
//     -F author=noah -F template=sakura-chroma \
//     -F html=@softshell-log.html

import { deleteDoc, publishDoc } from "@/lib/store";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
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

  const slug = String(form.get("slug") ?? "");
  const title = String(form.get("title") ?? "").slice(0, 120);
  const author = String(form.get("author") ?? "").slice(0, 60);
  const template = String(form.get("template") ?? "").slice(0, 60);
  // The author's directory-band aesthetic — baked into each person's skill so
  // every one of their docs lands in their own visual section. Falls back to a
  // neutral band if omitted or unknown.
  const authorStyle = String(form.get("authorStyle") ?? "plain").slice(0, 60);
  // What is actually being learned + a sentence for the directory card.
  const subject = String(form.get("subject") ?? "").slice(0, 80);
  const description = String(form.get("description") ?? "").slice(0, 280);
  // Progress through the topic's modules (optional but encouraged).
  const modulesDone = clampInt(form.get("modulesDone"), 0, 999);
  const modulesTotal = clampInt(form.get("modulesTotal"), 0, 999);
  const currentModule = String(form.get("currentModule") ?? "").slice(0, 80);

  const htmlField = form.get("html");
  const html =
    htmlField instanceof File ? await htmlField.text() : String(htmlField ?? "");

  if (!SLUG_PATTERN.test(slug)) {
    return json(400, { error: "slug must match " + String(SLUG_PATTERN) });
  }
  if (!title || !author || !template) {
    return json(400, { error: "title, author and template are all required" });
  }
  if (!subject || !description) {
    return json(400, {
      error:
        "subject and description are required — say what is being learned and give the directory card one or two sentences",
    });
  }
  if (!html.trimStart().toLowerCase().startsWith("<!doctype html")) {
    return json(400, { error: "html must be a complete document (<!doctype html …)" });
  }
  if (Buffer.byteLength(html, "utf-8") > MAX_HTML_BYTES) {
    return json(413, { error: "html exceeds 5MB" });
  }

  const meta = await publishDoc(
    {
      slug, title, subject, description, author, template, authorStyle,
      modulesDone, modulesTotal, currentModule,
    },
    html,
  );

  return json(200, { ok: true, url: `/d/${slug}`, meta });
}

// Remove a doc. Same shared secret; slug in the query string.
export async function DELETE(request: Request): Promise<Response> {
  if (request.headers.get("x-shelf-secret") !== process.env.SHELF_SECRET) {
    return json(401, { error: "bad or missing x-shelf-secret header" });
  }
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!SLUG_PATTERN.test(slug)) {
    return json(400, { error: "slug must match " + String(SLUG_PATTERN) });
  }
  await deleteDoc(slug);
  return json(200, { ok: true, deleted: slug });
}

function clampInt(value: FormDataEntryValue | null, lo: number, hi: number): number {
  const n = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
