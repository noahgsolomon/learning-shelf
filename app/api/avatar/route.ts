// Set (or replace) an author's polaroid: one small image per author, shown
// pinned over their paper section on the board. Same shared secret as
// publishing.
//
//   curl -X POST $SHELF_URL/api/avatar \
//     -H "x-shelf-secret: $SECRET" \
//     -F author=noah -F image=@me.jpg

import { avatarExtFor, setAvatar } from "@/lib/store";

const AUTHOR_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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

  const author = String(form.get("author") ?? "").toLowerCase();
  const image = form.get("image");

  if (!AUTHOR_PATTERN.test(author)) {
    return json(400, { error: "author must match " + String(AUTHOR_PATTERN) });
  }
  if (!(image instanceof File)) {
    return json(400, { error: "image file is required (-F image=@photo.jpg)" });
  }
  if (!avatarExtFor(image.type)) {
    return json(400, { error: "image must be png, jpeg, webp, or gif" });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return json(413, { error: "image exceeds 2MB — resize it down first" });
  }

  await setAvatar(author, Buffer.from(await image.arrayBuffer()), image.type);

  return json(200, { ok: true, url: `/a/${author}` });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
