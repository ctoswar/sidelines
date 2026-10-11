"use client";

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  genders,
  hands,
  levels,
  matches,
  playerSignupSchema,
  positions,
  profileColors,
  type PlayerSignupInput,
} from "@/lib/validators/auth";
import { homeFor, signUp } from "@/lib/auth";
import { savePlayerProfile } from "@/lib/player-profile";
import { Field } from "./field";
import { GoogleButton } from "./google-button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { AnimatedSelect } from "@/components/dashboard/animated-select";

const playingYears = Array.from({ length: 22 }, (_, index) => String(new Date().getFullYear() - index));
const steps = ["Identity", "Player details", "Ready"] as const;

type SelectName = "gender" | "position" | "level" | "dominantHand" | "playingSince" | "match";

function ProfileSelect({ control, name, label, options, error }: { control: Control<PlayerSignupInput>; name: SelectName; label: string; options: readonly string[]; error?: string }) {
  return (
    <div className="profile-signup-select">
      <span className="signup-field-label">{label}</span>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <AnimatedSelect
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            options={options.map((option) => ({ value: option, label: option }))}
            aria-label={label}
          />
        )}
      />
      {error && <p className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DatePickerField({ control, error }: { control: Control<PlayerSignupInput>; error?: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [yearPageStart, setYearPageStart] = useState(() => new Date().getFullYear() - 60);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setView("days"); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  return (
    <div ref={rootRef} className="profile-date-picker">
      <span className="signup-field-label">Date of birth</span>
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field }) => {
          const selected = field.value ? new Date(`${field.value}T00:00:00`) : null;
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
          const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
          const today = new Date();
          const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
          const label = selected
            ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "Select your birth date";

          return (
            <>
              <button type="button" className={`profile-date-trigger ${open ? "is-open" : ""}`} onClick={() => { setOpen((current) => !current); setView("days"); }} aria-expanded={open} aria-haspopup="dialog">
                <span className={selected ? "" : "is-placeholder"}>{label}</span><span aria-hidden="true">▣</span>
              </button>
              {open && (
                <div className="profile-date-menu" role="dialog" aria-label="Choose date of birth">
                  <div className="profile-date-menu-head">
                    <div className="profile-date-heading-buttons"><button type="button" className={view === "months" ? "is-active" : ""} onClick={() => setView(view === "days" ? "months" : "days")}>{month.toLocaleDateString("en-US", { month: "long" })}</button><button type="button" className={view === "years" ? "is-active" : ""} onClick={() => setView("years")}>{month.getFullYear()}</button></div>
                    <div><button type="button" onClick={() => view === "years" ? setYearPageStart((current) => current - 12) : setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous">‹</button><button type="button" onClick={() => view === "years" ? setYearPageStart((current) => current + 12) : setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next">›</button></div>
                  </div>
                  {view === "days" && <><div className="profile-date-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div><div className="profile-date-grid">{cells.map((day, index) => { if (!day) return <span key={`empty-${index}`} />; const picked = selected?.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth() && selected.getDate() === day; const future = new Date(month.getFullYear(), month.getMonth(), day) > today; return <button key={day} type="button" disabled={future} className={picked ? "is-picked" : ""} onClick={() => { field.onChange(dateValue(new Date(month.getFullYear(), month.getMonth(), day))); setOpen(false); }}>{day}</button>; })}</div><div className="profile-date-menu-foot"><button type="button" onClick={() => { field.onChange(""); setOpen(false); }}>Clear</button><button type="button" onClick={() => { field.onChange(dateValue(today)); setMonth(today); setOpen(false); }}>Today</button></div></>}
                  {view === "months" && <div className="profile-date-choice-grid profile-date-month-grid">{Array.from({ length: 12 }, (_, index) => <button key={index} type="button" className={index === month.getMonth() ? "is-picked" : ""} onClick={() => { setMonth((current) => new Date(current.getFullYear(), index, 1)); setView("days"); }}>{new Date(2020, index, 1).toLocaleDateString("en-US", { month: "short" })}</button>)}</div>}
                  {view === "years" && <div className="profile-date-choice-grid profile-date-year-grid">{Array.from({ length: 12 }, (_, index) => yearPageStart + index).map((year) => <button key={year} type="button" className={year === month.getFullYear() ? "is-picked" : ""} onClick={() => { setMonth((current) => new Date(year, current.getMonth(), 1)); setView("months"); }}>{year}</button>)}</div>}
                </div>
              )}
            </>
          );
        }}
      />
      {error && <p className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
}

export function PlayerSignupForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(0);
  const [profilePicture, setProfilePicture] = useState("");
  const [pictureError, setPictureError] = useState("");
  const { register, handleSubmit, watch, trigger, control, formState: { errors, isSubmitting } } = useForm<PlayerSignupInput>({
    resolver: zodResolver(playerSignupSchema),
    defaultValues: { terms: false, profileColor: profileColors[0] },
  });

  const name = watch("name") || "Your name";
  const username = watch("username") || "your.username";
  const profileColor = watch("profileColor") || profileColors[0];
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "YN";

  const onSubmit = async (data: PlayerSignupInput) => {
    const res = await signUp("player", data);
    setMessage(res.message);
    if (res.ok) {
      savePlayerProfile({
        username: data.username,
        name: data.name,
        nickname: data.nickname ?? "",
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        city: data.city,
        format: data.position,
        experience: data.level,
        dominantHand: data.dominantHand ?? "Right",
        playingSince: data.playingSince ?? "",
        match: data.match ?? "Prefer not to say",
        number: data.number ?? "",
        bio: data.bio ?? "",
        profileColor: data.profileColor ?? profileColors[0],
        profilePicture,
      });
      router.push(redirectTo?.startsWith("/") ? redirectTo : homeFor("player"));
    }
  };

  const next = async (fields: readonly (keyof PlayerSignupInput)[]) => {
    const valid = await trigger(fields);
    if (!valid) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadPicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPictureError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPictureError("Keep your profile picture under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePicture(typeof reader.result === "string" ? reader.result : "");
      setPictureError("");
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <GoogleButton onResult={setMessage} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="signup-profile-form">
        <div className="signup-profile-preview" style={{ "--profile-accent": profileColor } as CSSProperties}>
          <div className="signup-profile-orbit" aria-hidden="true" />
          <label className="signup-avatar-upload">
            {profilePicture ? <img src={profilePicture} alt="Profile preview" className="signup-avatar" /> : <span className="signup-avatar">{initials}</span>}
            <span className="signup-avatar-camera" aria-hidden="true">+</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPicture} />
          </label>
          <div className="signup-preview-copy">
            <p className="signup-kicker">Your sideline identity</p>
            <p className="signup-preview-name">{name}</p>
            <p className="signup-preview-handle">@{username}</p>
          </div>
          <span className="signup-preview-dot" aria-hidden="true" />
        </div>

        <div className="signup-progress" aria-label="Profile setup progress">
          {steps.map((label, index) => (
            <span key={label} className={index <= step ? "is-active" : ""}>
              <button type="button" disabled={index > step} onClick={() => index < step && setStep(index)} aria-current={index === step ? "step" : undefined}>
                <b>0{index + 1}</b> {label}
              </button>
            </span>
          ))}
        </div>

        {step === 0 && (
          <section key="identity" className="signup-form-section signup-step-panel">
            <div className="signup-section-heading"><span>01</span><div><p className="signup-kicker">Make it yours</p><h2>Set up your identity</h2></div></div>
            <div className="signup-field-grid">
              <div className="signup-field-wide">
                <Field label="Username" placeholder="maya.reyes" autoComplete="username" spellCheck={false} autoCapitalize="none" error={errors.username?.message} {...register("username")} />
                <p className="signup-field-hint">Your public handle · lowercase, numbers, periods, and underscores.</p>
              </div>
              <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
              <Field label="Nickname (optional)" placeholder="Maya" {...register("nickname")} />
              <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            </div>
          <div className="signup-color-picker">
              <div><p className="signup-field-label">Profile accent</p><p className="signup-field-hint">Pick a color for your player card.</p></div>
              <div className="signup-swatches" role="radiogroup" aria-label="Profile accent color">
                {profileColors.map((color) => (
                  <label key={color} className={`signup-swatch ${profileColor === color ? "is-selected" : ""}`} style={{ "--swatch": color } as CSSProperties}>
                    <input type="radio" value={color} aria-label={color} {...register("profileColor")} /><span />
                  </label>
                ))}
          </div>
          <p className="signup-picture-hint">Profile picture · JPG, PNG, or WebP · max 2 MB</p>
          {pictureError && <p className="mt-1 text-sm text-flag">{pictureError}</p>}
            </div>
            <div className="signup-step-actions"><button type="button" className="btn btn-pri" onClick={() => next(["username", "name", "email"])}>Continue to player details <b aria-hidden="true">→</b></button></div>
          </section>
        )}

        {step === 1 && (
          <section key="details" className="signup-form-section signup-step-panel">
            <div className="signup-section-heading"><span>02</span><div><p className="signup-kicker">The useful details</p><h2>Tell us how you play</h2></div></div>
            <div className="signup-field-grid">
              <DatePickerField control={control} error={errors.dateOfBirth?.message} />
              <ProfileSelect control={control} name="gender" label="Gender" options={genders} error={errors.gender?.message} />
              <Field label="Nationality" placeholder="Filipino" error={errors.nationality?.message} {...register("nationality")} />
              <Field label="City" placeholder="Imus, Cavite" error={errors.city?.message} {...register("city")} />
              <ProfileSelect control={control} name="position" label="Preferred format" options={positions} error={errors.position?.message} />
              <ProfileSelect control={control} name="level" label="Experience level" options={levels} error={errors.level?.message} />
              <ProfileSelect control={control} name="dominantHand" label="Dominant hand (optional)" options={hands} />
              <ProfileSelect control={control} name="playingSince" label="Playing since (optional)" options={playingYears} />
              <ProfileSelect control={control} name="match" label="Gender match" options={matches} error={errors.match?.message} />
              <Field label="Jersey number (optional)" placeholder="17" {...register("number")} />
              <div className="signup-field-wide"><label htmlFor="bio" className="signup-field-label">Short bio (optional)</label><textarea id="bio" maxLength={250} placeholder="A quick note for your team…" className="signup-textarea" {...register("bio")} />{errors.bio && <p className="mt-1 text-sm text-flag">{errors.bio.message}</p>}</div>
            </div>
            <div className="signup-step-actions"><button type="button" className="btn" onClick={back}>← Back</button><button type="button" className="btn btn-pri" onClick={() => next(["dateOfBirth", "gender", "nationality", "city", "position", "level"])}>Continue to login <b aria-hidden="true">→</b></button></div>
          </section>
        )}

        {step === 2 && (
          <section key="ready" className="signup-form-section signup-security-section signup-step-panel">
            <div className="signup-section-heading"><span>03</span><div><p className="signup-kicker">One last thing</p><h2>Create your login</h2></div></div>
            <div className="signup-field-grid">
              <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
              <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
              <div className="signup-field-wide"><Field label="Team join code (optional)" placeholder="IRON-4821" error={errors.code?.message} {...register("code")} /></div>
            </div>
            <div className="signup-step-actions"><button type="button" className="btn" onClick={back}>← Back</button><button type="submit" disabled={isSubmitting} className="btn btn-pri">{isSubmitting ? <LoadingDots label="Creating account" /> : <><span>Enter the sidelines</span><b aria-hidden="true">↗</b></>}</button></div>
            <label className="signup-terms"><input type="checkbox" {...register("terms")} /><span>I agree to the Terms of service and Privacy policy.</span></label>
            {errors.terms && <p className="mt-1 text-sm text-flag">{errors.terms.message}</p>}
          </section>
        )}
        <p role="status" className="text-sm font-medium text-brand">{message}</p>
      </form>
    </>
  );
}
