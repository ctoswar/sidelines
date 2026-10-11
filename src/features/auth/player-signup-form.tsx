"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Field } from "./field";
import { SelectField } from "./select-field";
import { GoogleButton } from "./google-button";
import { LoadingDots } from "@/components/ui/loading-dots";

const playingYears = Array.from({ length: 22 }, (_, index) => String(new Date().getFullYear() - index));

export function PlayerSignupForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<PlayerSignupInput>({
    resolver: zodResolver(playerSignupSchema),
    defaultValues: { terms: false, profileColor: profileColors[0] },
  });

  const name = watch("name") || "Your name";
  const username = watch("username") || "your.username";
  const profileColor = watch("profileColor") || profileColors[0];
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "YS";

  const onSubmit = async (data: PlayerSignupInput) => {
    const res = await signUp("player", data);
    setMessage(res.message);
    if (res.ok) router.push(redirectTo?.startsWith("/") ? redirectTo : homeFor("player"));
  };

  return (
    <>
      <GoogleButton onResult={setMessage} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="signup-profile-form">
        <div className="signup-profile-preview" style={{ "--profile-accent": profileColor } as React.CSSProperties}>
          <div className="signup-profile-orbit" aria-hidden="true" />
          <div className="signup-avatar">{initials}</div>
          <div className="signup-preview-copy">
            <p className="signup-kicker">Your sideline identity</p>
            <p className="signup-preview-name">{name}</p>
            <p className="signup-preview-handle">@{username}</p>
          </div>
          <span className="signup-preview-dot" aria-hidden="true" />
        </div>

        <div className="signup-progress" aria-label="Profile setup progress">
          <span className="is-active"><b>01</b> Identity</span>
          <i aria-hidden="true" />
          <span><b>02</b> Player details</span>
          <i aria-hidden="true" />
          <span><b>03</b> Ready</span>
        </div>

        <div className="signup-module-grid">
        <section className="signup-form-section signup-module-card">
          <div className="signup-section-heading">
            <span>01</span>
            <div>
              <p className="signup-kicker">Make it yours</p>
              <h2>Set up your identity</h2>
            </div>
          </div>

          <div className="signup-field-grid">
            <div className="signup-field-wide">
              <Field
                label="Username"
                placeholder="maya.reyes"
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="none"
                error={errors.username?.message}
                {...register("username")}
              />
              <p className="signup-field-hint">Your public handle · lowercase, numbers, periods, and underscores.</p>
            </div>
            <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
            <Field label="Nickname (optional)" placeholder="Maya" {...register("nickname")} />
            <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          </div>

          <div className="signup-color-picker">
            <div>
              <p className="signup-field-label">Profile accent</p>
              <p className="signup-field-hint">Pick a color for your player card.</p>
            </div>
            <div className="signup-swatches" role="radiogroup" aria-label="Profile accent color">
              {profileColors.map((color) => (
                <label key={color} className={`signup-swatch ${profileColor === color ? "is-selected" : ""}`} style={{ "--swatch": color } as React.CSSProperties}>
                  <input type="radio" value={color} aria-label={color} {...register("profileColor")} />
                  <span />
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="signup-form-section signup-module-card">
          <div className="signup-section-heading">
            <span>02</span>
            <div>
              <p className="signup-kicker">The useful details</p>
              <h2>Tell us how you play</h2>
            </div>
          </div>

          <div className="signup-field-grid">
            <Field label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register("dateOfBirth")} />
            <SelectField label="Gender" options={genders} error={errors.gender?.message} {...register("gender")} />
            <Field label="Nationality" placeholder="Filipino" error={errors.nationality?.message} {...register("nationality")} />
            <Field label="City" placeholder="Imus, Cavite" error={errors.city?.message} {...register("city")} />
            <SelectField label="Preferred format" options={positions} error={errors.position?.message} {...register("position")} />
            <SelectField label="Experience level" options={levels} error={errors.level?.message} {...register("level")} />
            <SelectField label="Dominant hand (optional)" options={hands} {...register("dominantHand")} />
            <SelectField label="Playing since (optional)" options={playingYears} {...register("playingSince")} />
            <SelectField label="Gender match" options={matches} error={errors.match?.message} {...register("match")} />
            <Field label="Jersey number (optional)" placeholder="17" {...register("number")} />
            <div className="signup-field-wide">
              <label htmlFor="bio" className="signup-field-label">Short bio (optional)</label>
              <textarea id="bio" maxLength={250} placeholder="A quick note for your team…" className="signup-textarea" {...register("bio")} />
              {errors.bio && <p className="mt-1 text-sm text-flag">{errors.bio.message}</p>}
            </div>
          </div>
        </section>
        </div>

        <section className="signup-form-section signup-security-section">
          <div className="signup-section-heading">
            <span>03</span>
            <div>
              <p className="signup-kicker">Keep it secure</p>
              <h2>Create your login</h2>
            </div>
          </div>
          <div className="signup-field-grid">
            <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
            <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
            <div className="signup-field-wide">
              <Field label="Team join code (optional)" placeholder="IRON-4821" error={errors.code?.message} {...register("code")} />
            </div>
          </div>
        </section>

        <div className="signup-submit-area">
          <label className="signup-terms">
            <input type="checkbox" {...register("terms")} />
            <span>I agree to the Terms of service and Privacy policy.</span>
          </label>
          {errors.terms && <p className="mt-1 text-sm text-flag">{errors.terms.message}</p>}
          <button disabled={isSubmitting} className="btn btn-pri signup-submit">
            {isSubmitting ? <LoadingDots label="Creating account" /> : <><span>Enter the sidelines</span><b aria-hidden="true">↗</b></>}
          </button>
          <p role="status" className="text-sm font-medium text-brand">{message}</p>
        </div>
      </form>
    </>
  );
}
