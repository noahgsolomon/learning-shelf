// Mint an invite: a paste-into-your-agent installer carrying the three skills
// (shelf contributor + learn + beautiful-html-templates), personalized with
// the friend's name, band style, and a freshly minted owner token that makes
// their corner theirs alone. Gated by the group password. Multipart so an
// optional polaroid photo can ride along with the claim.

import { buildInviteInstaller } from "@/lib/invite";
import { hashOwnerToken, mintOwnerToken } from "@/lib/owner";
import {
  avatarExtFor,
  claimAuthor,
  getAuthorRecord,
  listDocs,
  setAvatar,
} from "@/lib/store";

const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "expected multipart form data" });
  }

  // The friend-group gate: minting an installer hands out the upload secret,
  // so prove you belong first. Set INVITE_PASSWORD in the environment.
  const expected = process.env.INVITE_PASSWORD;
  if (!expected) {
    return json(500, { error: "server is missing INVITE_PASSWORD" });
  }
  if (String(form.get("password") ?? "") !== expected) {
    return json(401, { error: "wrong password — ask a friend for the shelf password" });
  }

  // One corner per name: minting a kit claims the author name and binds a
  // fresh owner token to it. A taken name can't be re-minted — otherwise
  // anyone with the shelf password could grab someone else's corner.
  const rawName = String(form.get("name") ?? "");
  const author = rawName.trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9-]/g, "");
  if (!author) {
    return json(400, { error: "give us a name first" });
  }

  // Validate the optional polaroid BEFORE claiming, so a bad file doesn't
  // burn the name.
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!avatarExtFor(photo.type)) {
      return json(400, { error: "photo must be png, jpeg, webp, or gif" });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return json(413, { error: "photo exceeds 50MB — pick a smaller one" });
    }
  }

  const [record, docs] = await Promise.all([getAuthorRecord(author), listDocs()]);
  const hasDocs = docs.some((d) => d.author.toLowerCase() === author);
  if (record || hasDocs) {
    return json(409, {
      error: `"${author}" already has a corner on the shelf — if it's yours, your original kit still works; otherwise pick another name`,
    });
  }

  const ownerToken = mintOwnerToken();
  await claimAuthor(author, hashOwnerToken(ownerToken));

  if (photo instanceof File && photo.size > 0) {
    await setAvatar(author, Buffer.from(await photo.arrayBuffer()), photo.type);
  }

  const installer = buildInviteInstaller(
    rawName,
    String(form.get("style") ?? "plain"),
    ownerToken,
  );

  return json(200, { installer });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
