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

const PROFILE_KEY = "sidelines.demo.player-profile";

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

export function getPlayerProfile(): PlayerProfile {
  if (typeof window === "undefined") return DEFAULT_PLAYER_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PLAYER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return { ...DEFAULT_PLAYER_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PLAYER_PROFILE;
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  if (typeof window !== "undefined") window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
