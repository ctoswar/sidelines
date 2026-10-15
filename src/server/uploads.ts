// Disk-backed upload storage.
//
// Photos are written under UPLOAD_DIR (./var/uploads by default, gitignored)
// as `<userId>/<timestamp>-<rand>.<ext>`. The database stores only the
// relative path — never a data URL, never an absolute path — and every read
// re-resolves it inside the upload root so a stray value cannot escape.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Accepted photo types, verified by magic bytes — the client's file.type is a hint, not proof. */
export const PHOTO_TYPES: Record<string, { ext: string; magic: (bytes: Buffer) => boolean }> = {
  "image/jpeg": {
    ext: ".jpg",
    magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/png": {
    ext: ".png",
    magic: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  "image/webp": {
    ext: ".webp",
    magic: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  },
};

const MIME_BY_EXT = new Map(
  Object.entries(PHOTO_TYPES).map(([mime, { ext }]) => [ext, mime]),
);

export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./var/uploads");
}

/** Returns the mime type implied by the stored file's extension, if it is one we wrote. */
export function photoMimeFor(relativePath: string): string | null {
  return MIME_BY_EXT.get(path.extname(relativePath).toLowerCase()) ?? null;
}

/** Sniffs the real image type from the file's leading bytes. */
export function sniffPhotoType(bytes: Buffer): string | null {
  for (const [mime, { magic }] of Object.entries(PHOTO_TYPES)) {
    if (magic(bytes)) return mime;
  }
  return null;
}

/**
 * Resolves a stored relative path inside the upload root.
 * Returns null if the value is empty or points outside the root.
 */
export function resolveStoredPhoto(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const root = uploadRoot();
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/** Writes the bytes under `<root>/<userId>/` and returns the relative path to store. */
export async function saveUserPhoto(userId: string, bytes: Buffer, mime: string): Promise<string> {
  const { ext } = PHOTO_TYPES[mime];
  const dir = path.join(uploadRoot(), userId);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return path.posix.join(userId, name);
}

/**
 * Writes a team banner under `<root>/team-<userId>/` — a sibling tree, not a
 * subfolder of the photo dir, so the profile flows (serve, replace, delete,
 * and their "exactly one file" guarantees) never see banner files.
 */
export async function saveTeamBanner(userId: string, bytes: Buffer, mime: string): Promise<string> {
  const { ext } = PHOTO_TYPES[mime];
  const owner = `team-${userId}`;
  const dir = path.join(uploadRoot(), owner);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return path.posix.join(owner, name);
}

/** Reads a stored photo's bytes, or null when it is missing or escapes the root. */
export async function readStoredPhoto(relativePath: string): Promise<Buffer | null> {
  const resolved = resolveStoredPhoto(relativePath);
  if (!resolved) return null;
  return readFile(resolved).catch(() => null);
}

/** Removes a stored photo, ignoring a missing file. */
export async function deleteStoredPhoto(relativePath: string | null | undefined): Promise<void> {
  const resolved = resolveStoredPhoto(relativePath);
  if (!resolved) return;
  await unlink(resolved).catch(() => undefined);
}
