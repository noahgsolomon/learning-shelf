// Serve an author's polaroid photo. 404s plainly when the author hasn't set
// one — the board only links here for authors that have.

import { getAvatar } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ author: string }> },
): Promise<Response> {
  const { author } = await params;
  const avatar = await getAvatar(author.toLowerCase());

  if (!avatar) {
    return new Response("No polaroid for this author.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(new Uint8Array(avatar.bytes), {
    status: 200,
    headers: {
      "content-type": avatar.contentType,
      // Replaceable at any time; keep it fresh like the docs.
      "cache-control": "no-store",
    },
  });
}
