// Send a SportsHub a message from its public page.
//
//   POST /api/hubs/[slug]/message — { body }
//
// The message is stored against the hub so it is a real action, not a toast.
// Organizers read them from the hub's inbox in a later slice; the response
// only confirms the write.

import { NextResponse } from "next/server";
import { findHubBySlug, sendHubMessage } from "@/server/hubs";
import { getServerSessionUser } from "@/server/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const hub = await findHubBySlug(slug);
  if (!hub) return NextResponse.json({ message: "SportsHub not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (message.length < 2) {
    return NextResponse.json({ message: "Write a message first." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ message: "Keep the message under 2,000 characters." }, { status: 400 });
  }

  await sendHubMessage({
    hubId: hub.id,
    userId: user.id,
    fromName: user.name || user.username || "Player",
    fromEmail: user.email,
    body: message,
  });

  return NextResponse.json({ ok: true });
}
