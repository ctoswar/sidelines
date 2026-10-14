"use client";

import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import { useToast } from "@/components/dashboard/use-toast";
import { genders, hands, levels, matches, positions, profileColors } from "@/lib/validators/auth";
import {
  BLANK_PLAYER_PROFILE,
  deleteProfilePicture,
  fetchPlayerProfile,
  savePlayerProfile,
  uploadProfilePicture,
  type PlayerProfile,
} from "@/lib/player-profile";
import { useSession } from "@/lib/auth";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PR";
}

function ProfileField({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "profile-field profile-field-wide" : "profile-field"}><span>{label}</span>{children}</label>;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function ProfileView() {
  const { show, node } = useToast();
  const [profile, setProfile] = useState<PlayerProfile>(BLANK_PLAYER_PROFILE);
  const [draft, setDraft] = useState<PlayerProfile>(BLANK_PLAYER_PROFILE);
  const [busy, setBusy] = useState(false);
  const session = useSession();

  // The profile lives in Postgres now, so it arrives after mount. Until then
  // the page shows blanks rather than the seed's demo identity.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    fetchPlayerProfile()
      .then((loaded) => {
        if (!alive) return;
        setProfile(loaded);
        setDraft(loaded);
      })
      .catch((error: Error) => alive && show(error.message));
    return () => { alive = false; };
  }, [session, show]);

  const patch = (changes: Partial<PlayerProfile>) => setDraft((current) => ({ ...current, ...changes }));
  const accentStyle = { "--profile-accent": draft.profileColor } as CSSProperties;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await savePlayerProfile(draft);
      setProfile(saved);
      setDraft(saved);
      show("Profile saved");
    } catch (error) {
      show((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    // Reset so choosing the same file twice still fires a change event.
    input.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      show("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      show("Keep your profile picture under 2 MB.");
      return;
    }
    setBusy(true);
    try {
      // The file goes straight to the server as multipart — the old version
      // read it into a base64 data URL and stored that in localStorage.
      const updated = await uploadProfilePicture(file);
      setProfile(updated);
      setDraft(updated);
      show("Photo updated");
    } catch (error) {
      show((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removePicture = async () => {
    setBusy(true);
    try {
      const updated = await deleteProfilePicture();
      setProfile(updated);
      setDraft(updated);
      show("Photo removed");
    } catch (error) {
      show((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="profile-page max-w-4xl">
        <section className="profile-hero" style={accentStyle}>
          <div className="profile-hero-orbit" aria-hidden="true" />
          <div className="profile-avatar-wrap">
            <label className="profile-avatar-upload">
              {draft.profilePicture ? <img src={draft.profilePicture} alt="Profile preview" className="profile-avatar" /> : <span className="profile-avatar">{initials(draft.name)}</span>}
              <span className="profile-avatar-camera" aria-hidden="true">+</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPicture} disabled={busy} />
            </label>
            {draft.profilePicture && (
              <button type="button" className="profile-photo-remove" onClick={removePicture} disabled={busy}>
                Remove photo
              </button>
            )}
          </div>
          <div className="profile-hero-copy">
            <p className="profile-kicker">Pickleball player</p>
            <h2>{draft.name || "Your name"}</h2>
            <p>@{draft.username || "your.username"} · {draft.city || "Add your city"}</p>
          </div>
          <span className="profile-live-dot" aria-hidden="true" />
        </section>

        <div className="profile-accent-row">
          <div>
            <p className="profile-label">Profile accent</p>
            <p className="profile-hint">Your color follows you across the player workspace.</p>
          </div>
          <div className="profile-swatches" role="radiogroup" aria-label="Profile accent color">
            {profileColors.map((color) => (
              <label key={color} className={`profile-swatch ${draft.profileColor === color ? "is-selected" : ""}`} style={{ "--swatch": color } as CSSProperties}>
                <input type="radio" value={color} checked={draft.profileColor === color} onChange={() => patch({ profileColor: color })} aria-label={color} />
                <span />
              </label>
            ))}
          </div>
        </div>

        <div className="profile-module-grid">
          <section className="profile-card">
            <div className="profile-card-heading"><span>01</span><div><p className="profile-kicker">Your identity</p><h3>Player details</h3></div></div>
            <div className="profile-field-grid">
              <ProfileField label="Username" wide><input value={draft.username} onChange={(event) => patch({ username: event.target.value })} /></ProfileField>
              <ProfileField label="Full name"><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></ProfileField>
              <ProfileField label="Nickname"><input value={draft.nickname} onChange={(event) => patch({ nickname: event.target.value })} /></ProfileField>
              <ProfileField label="Email"><input value={draft.email} onChange={(event) => patch({ email: event.target.value })} type="email" /></ProfileField>
              <ProfileField label="City"><input value={draft.city} onChange={(event) => patch({ city: event.target.value })} /></ProfileField>
              <ProfileField label="Nationality"><input value={draft.nationality} onChange={(event) => patch({ nationality: event.target.value })} /></ProfileField>
              <ProfileField label="Date of birth"><input value={draft.dateOfBirth} onChange={(event) => patch({ dateOfBirth: event.target.value })} type="date" /></ProfileField>
              <ProfileField label="Gender"><select value={draft.gender} onChange={(event) => patch({ gender: event.target.value })}>{genders.map((option) => <option key={option}>{option}</option>)}</select></ProfileField>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-heading"><span>02</span><div><p className="profile-kicker">Your game</p><h3>Pickleball playbook</h3></div></div>
            <div className="profile-field-grid">
              <ProfileField label="Preferred format"><select value={draft.format} onChange={(event) => patch({ format: event.target.value })}>{positions.map((option) => <option key={option}>{option}</option>)}</select></ProfileField>
              <ProfileField label="Experience"><select value={draft.experience} onChange={(event) => patch({ experience: event.target.value })}>{levels.map((option) => <option key={option}>{option}</option>)}</select></ProfileField>
              <ProfileField label="Dominant hand"><select value={draft.dominantHand} onChange={(event) => patch({ dominantHand: event.target.value })}>{hands.map((option) => <option key={option}>{option}</option>)}</select></ProfileField>
              <ProfileField label="Playing since"><input value={draft.playingSince} onChange={(event) => patch({ playingSince: event.target.value })} /></ProfileField>
              <ProfileField label="Match category"><select value={draft.match} onChange={(event) => patch({ match: event.target.value })}>{matches.map((option) => <option key={option}>{option}</option>)}</select></ProfileField>
              <ProfileField label="Jersey number"><input value={draft.number} onChange={(event) => patch({ number: event.target.value })} inputMode="numeric" /></ProfileField>
              <ProfileField label="Player bio" wide><textarea value={draft.bio} maxLength={250} onChange={(event) => patch({ bio: event.target.value })} /></ProfileField>
            </div>
          </section>
        </div>

        <div className="profile-footer">
          <p><b>{profile.format}</b> player · {profile.experience} · ready for the next rally.</p>
          <button className="btn btn-pri" onClick={save} disabled={busy}>Save profile <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      {node}
    </>
  );
}
