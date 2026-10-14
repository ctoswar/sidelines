// Player profile photo.
//
//   POST   /api/profile/photo — multipart upload (field name: "photo")
//   GET    /api/profile/photo — serve the signed-in player's photo
//   DELETE /api/profile/photo — remove it
//
// The file is validated by magic bytes, not the client-declared type, then
// written under UPLOAD_DIR keyed by user id. The old file is deleted only
// after the new one is safely on disk and the row updated.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import {
  PHOTO_MAX_BYTES,
  deleteStoredPhoto,
  photoMimeFor,
  readStoredPhoto,
  saveUserPhoto,
  sniffPhotoType,
} from "@/server/uploads";

async function playerOrError() {
  const user = await getServerSessionUser();
  if (!user) return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  if (user.role !== "player") {
    return { error: NextResponse.json({ message: "Only player accounts have a profile photo." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request: Request) {
  const { user, error } = await playerOrError();
  if (error) return error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ message: "Keep your profile picture under 2 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffPhotoType(bytes);
  if (!mime) {
    return NextResponse.json({ message: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  }

  const existing = await db.select({ photoPath: t.playerProfiles.photoPath })
    .from(t.playerProfiles).where(eq(t.playerProfiles.userId, user.id)).limit(1);

  const photoPath = await saveUserPhoto(user.id, bytes, mime);

  await db.insert(t.playerProfiles).values({ userId: user.id, photoPath, updatedAt: new Date() })
    .onConflictDoUpdate({ target: t.playerProfiles.userId, set: { photoPath, updatedAt: new Date() } });

  // Swap complete — now the previous file can go.
  await deleteStoredPhoto(existing[0]?.photoPath);

  return NextResponse.json({ photoPath });
}

export async function GET() {
  const { user, error } = await playerOrError();
  if (error) return error;

  const [row] = await db.select({ photoPath: t.playerProfiles.photoPath })
    .from(t.playerProfiles).where(eq(t.playerProfiles.userId, user.id)).limit(1);

  const bytes = row?.photoPath ? await readStoredPhoto(row.photoPath) : null;
  if (!bytes) return NextResponse.json({ message: "No photo on file." }, { status: 404 });

  const mime = photoMimeFor(row!.photoPath!) ?? "image/jpeg";
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

  const [row] = await db.select({ photoPath: t.playerProfiles.photoPath })
    .from(t.playerProfiles).where(eq(t.playerProfiles.userId, user.id)).limit(1);

  await db.update(t.playerProfiles)
    .set({ photoPath: null, updatedAt: new Date() })
    .where(eq(t.playerProfiles.userId, user.id));

  await deleteStoredPhoto(row?.photoPath);

  return NextResponse.json({ ok: true });
}
