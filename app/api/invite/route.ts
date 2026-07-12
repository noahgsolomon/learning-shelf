// Mint an invite: a paste-into-Claude installer carrying the three skills
// (shelf contributor + learn + beautiful-html-templates), personalized with
// the friend's name and band style. Deliberately ungated — the shelf is a
// friend-group board and the button on the site is the front door.

import { buildInviteInstaller } from "@/lib/invite";

export async function POST(request: Request): Promise<Response> {
  let body: { name?: string; style?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "expected JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // The friend-group gate: minting an installer hands out the upload secret,
  // so prove you belong first. Set INVITE_PASSWORD in the environment.
  const expected = process.env.INVITE_PASSWORD;
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "server is missing INVITE_PASSWORD" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  if (String(body.password ?? "") !== expected) {
    return new Response(
      JSON.stringify({ error: "wrong password — ask a friend for the shelf password" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const installer = buildInviteInstaller(
    String(body.name ?? ""),
    String(body.style ?? "plain"),
  );

  return new Response(JSON.stringify({ installer }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
