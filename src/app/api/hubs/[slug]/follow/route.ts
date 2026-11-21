// Follow / unfollow a SportsHub.
//
//   POST   /api/hubs/[slug]/follow
//   DELETE /api/hubs/[slug]/follow
//
// Any signed-in account may follow a club. The pair is unique, so double
// clicks are idempotent; the response carries the total the button renders.

import { NextResponse } from "next/server";
import { findHubBySlug, followHub, unfollowHub } from "@/server/hubs";
import { getServerSessionUser } from "@/server/session";

async function hubOr404(slug: string) {
  const hub = await findHubBySlug(slug);
  if (!hub) return { error: NextResponse.json({ message: "SportsHub not found." }, { status: 404 }) };
  return { hub };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const { hub, error } = await hubOr404(slug);
  if (error) return error;

  return NextResponse.json(await followHub(hub!.id, user.id));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const { hub, error } = await hubOr404(slug);
  if (error) return error;

  return NextResponse.json(await unfollowHub(hub!.id, user.id));
}
