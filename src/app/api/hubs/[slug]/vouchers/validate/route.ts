// Checkout voucher validation.
//
//   POST /api/hubs/[slug]/vouchers/validate — { templateId, playerCount, code }
//
// Any signed-in player may call this: it prices the code against the session
// subtotal and returns the full quote the checkout screen shows. The confirm
// endpoint re-runs the same math, so this only previews.

import { NextResponse } from "next/server";
import { findHubBySlug, quoteOpenPlay } from "@/server/hubs";
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
  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const playerCount = Number(body?.playerCount);
  if (!templateId) {
    return NextResponse.json({ message: "Pick an open-play session first." }, { status: 400 });
  }

  const result = await quoteOpenPlay({
    hubId: hub.id,
    templateId,
    playerCount: Number.isFinite(playerCount) ? playerCount : 1,
    voucherCode: code,
  });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ quote: result.quote });
}
