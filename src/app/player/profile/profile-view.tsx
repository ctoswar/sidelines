"use client";

import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import { useToast } from "@/components/dashboard/use-toast";
import { genders, hands, levels, matches, positions, profileColors } from "@/lib/validators/auth";
import { DEFAULT_PLAYER_PROFILE, getPlayerProfile, savePlayerProfile, type PlayerProfile } from "@/lib/player-profile";
import { getSession } from "@/lib/auth";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PR";
}

function usernameFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 20) || "pickleball.player";
}

function ProfileField({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "profile-field profile-field-wide" : "profile-field"}><span>{label}</span>{children}</label>;
}

export function ProfileView() {
  const { show, node } = useToast();
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [draft, setDraft] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);

  useEffect(() => {
    const saved = getPlayerProfile();
    const session = getSession();
    const current = session?.role === "player"
      ? {
          ...saved,
          name: session.name,
          email: session.email,
          username: session.username || usernameFromName(session.name),
        }
      : saved;
    setProfile(current);
    setDraft(current);
  }, []);

  const patch = (changes: Partial<PlayerProfile>) => setDraft((current) => ({ ...current, ...changes }));
  const accentStyle = { "--profile-accent": draft.profileColor } as CSSProperties;

  const save = () => {
    savePlayerProfile(draft);
    setProfile(draft);
    show("Profile saved");
  };

  const uploadPicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      show("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      show("Keep your profile picture under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") patch({ profilePicture: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="profile-page max-w-4xl">
        <section className="profile-hero" style={accentStyle}>
          <div className="profile-hero-orbit" aria-hidden="true" />
          <label className="profile-avatar-upload">
            {draft.profilePicture ? <img src={draft.profilePicture} alt="Profile preview" className="profile-avatar" /> : <span className="profile-avatar">{initials(draft.name)}</span>}
            <span className="profile-avatar-camera" aria-hidden="true">+</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPicture} />
          </label>
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
          <button className="btn btn-pri" onClick={save}>Save profile <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      {node}
    </>
  );
}
