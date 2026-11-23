// A hub owner's discount codes.
//
//   GET    /api/hubs/[slug]/vouchers          — the owner's list
//   POST   /api/hubs/[slug]/vouchers          — create { code, kind, value }
//   PATCH  /api/hubs/[slug]/vouchers          — toggle { id, active }
//
// Only the signed-in owner of the hub's organization may read or write;
// players meet these codes at checkout instead.

import { NextResponse } from "next/server";
import {
  createHubVoucher,
  findHubBySlug,
  listHubVouchers,
  setHubVoucherActive,
} from "@/server/hubs";
import { getServerSessionUser } from "@/server/session";

async function hubOr404(slug: string) {
  const hub = await findHubBySlug(slug);
  if (!hub) {
    return { error: NextResponse.json({ message: "SportsHub not found." }, { status: 404 }) };
  }
  return { hub };
}

async function ownerOr403(slug: string) {
  const user = await getServerSessionUser();
  if (!user) {
    return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  }
  const { hub, error } = await hubOr404(slug);
  if (error) return { error };
  return { hub, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await ownerOr403((await params).slug);
  if ("error" in guard) return guard.error;

  const result = await listHubVouchers(guard.hub!.id, guard.user!.id);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ vouchers: result.vouchers });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await ownerOr403((await params).slug);
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const kind = body?.kind === "amount" ? "amount" : "percent";
  const value = Number(body?.value);
  if (!code || !Number.isFinite(value)) {
    return NextResponse.json({ message: "Give the code and its value." }, { status: 400 });
  }

  const result = await createHubVoucher(guard.hub!.id, guard.user!.id, { code, kind, value });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ voucher: result.vouchers[0] ?? null }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await ownerOr403((await params).slug);
  if ("error" in guard) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "Which voucher?" }, { status: 400 });
  }

  const result = await setHubVoucherActive(guard.hub!.id, guard.user!.id, id, Boolean(body?.active));
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ voucher: result.vouchers[0] ?? null });
}
