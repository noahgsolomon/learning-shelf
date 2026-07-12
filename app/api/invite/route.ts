// Mint an invite: a paste-into-Claude installer carrying the three skills
// (shelf contributor + learn + beautiful-html-templates), personalized with
// the friend's name and band style. Deliberately ungated — the shelf is a
// friend-group board and the button on the site is the front door.

import { buildInviteInstaller } from "@/lib/invite";

export async function POST(request: Request): Promise<Response> {
  let body: { name?: string; style?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "expected JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
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
