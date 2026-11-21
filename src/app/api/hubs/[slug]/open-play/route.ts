// Join / leave a SportsHub open-play session.
//
//   POST   /api/hubs/[slug]/open-play — { templateId, date }
//   DELETE /api/hubs/[slug]/open-play?templateId=…&date=…
//
// Sessions are weekly templates expanded per date, so the pair (template,
// date) identifies one occurrence. Capacity is enforced against that
// occurrence; the unique index keeps repeat clicks idempotent.

import { NextResponse } from "next/server";
import { findHubBySlug, joinOpenPlay, leaveOpenPlay } from "@/server/hubs";
import { getServerSessionUser } from "@/server/session";

async function hubOr404(slug: string) {
  const hub = await findHubBySlug(slug);
  if (!hub) {
    return { error: NextResponse.json({ message: "SportsHub not found." }, { status: 404 }) };
  }
  return { hub };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const { hub, error } = await hubOr404(slug);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  if (!templateId || !date) {
    return NextResponse.json({ message: "Pick an open-play session first." }, { status: 400 });
  }

  const result = await joinOpenPlay({ hubId: hub!.id, templateId, date, userId: user.id });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ session: result.session });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const { hub, error } = await hubOr404(slug);
  if (error) return error;

  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  if (!templateId || !date) {
    return NextResponse.json({ message: "Pick an open-play session first." }, { status: 400 });
  }

  const result = await leaveOpenPlay({ hubId: hub!.id, templateId, date, userId: user.id });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ session: result.session });
}
