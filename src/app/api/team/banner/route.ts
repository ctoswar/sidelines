// Team banner image.
//
//   POST   /api/team/banner — multipart upload (field name: "banner")
//   GET    /api/team/banner — serve the signed-in player's banner
//   DELETE /api/team/banner — remove it, falling back to the preset gradient
//
// Same contract as the profile photo: magic bytes beat the client-declared
// type, the file lands in its own `team-<userId>/` tree under UPLOAD_DIR (so
// photo and banner flows never see each other's files), and the previous
// file is deleted only after the new one is on disk and the row updated.
// The client crops to 1600×500 JPEG before sending, which is what keeps the
// upload small — the size cap is really a "you skipped our crop" guard.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import {
  PHOTO_MAX_BYTES,
  deleteStoredPhoto,
  photoMimeFor,
  readStoredPhoto,
  saveTeamBanner,
  sniffPhotoType,
} from "@/server/uploads";
import { loadTeamRow, toTeamWire, writeTeam } from "@/server/team";

async function playerOrError() {
  const user = await getServerSessionUser();
  if (!user) return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  if (user.role !== "player") {
    return { error: NextResponse.json({ message: "Only players have a team banner." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request: Request) {
  const { user, error } = await playerOrError();
  if (error) return error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("banner");
  if (!file || typeof file === "string") {
    return NextResponse.json({ message: "Choose a banner image to upload." }, { status: 400 });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ message: "Keep your banner image under 2 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffPhotoType(bytes);
  if (!mime) {
    return NextResponse.json({ message: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  }

  const existing = await loadTeamRow(user.id);
  const bannerPath = await saveTeamBanner(user.id, bytes, mime);
  const row = await writeTeam(user.id, { bannerPath });

  // Swap complete — now the previous banner can go.
  await deleteStoredPhoto(existing?.bannerPath);

  return NextResponse.json({ team: toTeamWire(row) });
}

export async function GET() {
  const { user, error } = await playerOrError();
  if (error) return error;

  const row = await loadTeamRow(user.id);
  const path = row?.bannerPath || null;
  const bytes = path ? await readStoredPhoto(path) : null;
  if (!path || !bytes) return NextResponse.json({ message: "No banner on file." }, { status: 404 });

  const mime = photoMimeFor(path) ?? "image/jpeg";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // The path gains a new name on every upload, so the URL can be cached hard.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE() {
  const { user, error } = await playerOrError();
  if (error) return error;

  const row = await loadTeamRow(user.id);
  if (row?.bannerPath) {
    await writeTeam(user.id, { bannerPath: "" });
    await deleteStoredPhoto(row.bannerPath);
  }

  return NextResponse.json({ team: toTeamWire(row ? { ...row, bannerPath: "" } : null) });
}
