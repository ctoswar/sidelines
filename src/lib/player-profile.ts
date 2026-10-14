// Player profile client.
//
// The profile now lives in Postgres behind /api/profile; this module keeps
// the same PlayerProfile shape the UI already speaks and maps it onto the
// API. `profilePicture` is a URL (`/api/profile/photo`) or "" — never a data
// URL, which is what made the old localStorage version grow without bound.
//
// DEFAULT_PLAYER_PROFILE is kept for the seed script and as a neutral first
// paint before the fetch resolves; it is no longer what gets saved.

export type PlayerProfile = {
  username: string;
  name: string;
  nickname: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  city: string;
  format: string;
  experience: string;
  dominantHand: string;
  playingSince: string;
  match: string;
  number: string;
  bio: string;
  profileColor: string;
  profilePicture: string;
};

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  username: "alex.rivera",
  name: "Alex Rivera",
  nickname: "Alex",
  email: "player@example.com",
  dateOfBirth: "1998-06-14",
  gender: "Prefer not to say",
  nationality: "Filipino",
  city: "Imus, Cavite",
  format: "Singles",
  experience: "Recreational",
  dominantHand: "Right",
  playingSince: "2024",
  match: "Open",
  number: "17",
  bio: "Always ready for one more game.",
  profileColor: "#c8ef70",
  profilePicture: "",
};

/** Neutral starting point while the real profile loads. */
export const BLANK_PLAYER_PROFILE: PlayerProfile = {
  ...DEFAULT_PLAYER_PROFILE,
  username: "",
  name: "",
  nickname: "",
  email: "",
  dateOfBirth: "",
  city: "",
  nationality: "",
  playingSince: "",
  number: "",
  bio: "",
  profilePicture: "",
};

/** Wire shape: everything the JSON API returns, plus the stored photo path. */
type WireProfile = Omit<PlayerProfile, "profilePicture"> & { photoPath: string | null };

function fromWire(wire: WireProfile): PlayerProfile {
  const { photoPath, ...rest } = wire;
  return {
    ...rest,
    // Cache-bust on demand: the photo URL is stable, the file behind it is not.
    profilePicture: photoPath ? `/api/profile/photo?v=${encodeURIComponent(photoPath)}` : "",
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  if (!body) throw new Error("The server sent an unexpected response.");
  return body;
}

/** Fetches the signed-in player's profile. Throws when signed out or on error. */
export async function fetchPlayerProfile(): Promise<PlayerProfile> {
  const body = await parse<{ profile: WireProfile }>(await fetch("/api/profile"));
  return fromWire(body.profile);
}

/** Saves profile fields; returns the updated profile as the server sees it. */
export async function savePlayerProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  const { profilePicture: _ignored, ...fields } = profile;
  const body = await parse<{ profile: WireProfile }>(
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }),
  );
  return fromWire(body.profile);
}

/** Uploads a photo; returns the new profile with a fresh photo URL. */
export async function uploadProfilePicture(file: File): Promise<PlayerProfile> {
  const form = new FormData();
  form.append("photo", file);
  const body = await parse<{ photoPath: string }>(
    await fetch("/api/profile/photo", { method: "POST", body: form }),
  );
  const { profilePicture: _ignored, ...fields } = await fetchPlayerProfile();
  return { ...fields, profilePicture: `/api/profile/photo?v=${encodeURIComponent(body.photoPath)}` };
}

/** Removes the photo; returns the updated profile. */
export async function deleteProfilePicture(): Promise<PlayerProfile> {
  await parse<{ ok: boolean }>(await fetch("/api/profile/photo", { method: "DELETE" }));
  return fetchPlayerProfile();
}
