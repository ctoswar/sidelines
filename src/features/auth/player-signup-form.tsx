"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levels, matches, playerSignupSchema, positions, type PlayerSignupInput } from "@/lib/validators/auth";
import { homeFor, signUp } from "@/lib/auth";
import { Field } from "./field";
import { SelectField } from "./select-field";
import { GoogleButton } from "./google-button";
import { LoadingDots } from "@/components/ui/loading-dots";

export function PlayerSignupForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PlayerSignupInput>({
    resolver: zodResolver(playerSignupSchema),
    defaultValues: { terms: false },
  });

  const onSubmit = async (data: PlayerSignupInput) => {
    const res = await signUp("player", data);
    setMessage(res.message);
    if (res.ok) router.push(redirectTo?.startsWith("/") ? redirectTo : homeFor("player"));
  };

  return (
    <>
      <GoogleButton onResult={setMessage} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        <hr className="border-line" />
        <p className="font-bold">Player details</p>
        <Field label="City" placeholder="Imus, Cavite" error={errors.city?.message} {...register("city")} />
        <SelectField label="Position" options={positions} error={errors.position?.message} {...register("position")} />
        <SelectField label="Experience" options={levels} error={errors.level?.message} {...register("level")} />
        <SelectField label="Gender match (for mixed divisions)" options={matches} error={errors.match?.message} {...register("match")} />
        <Field label="Jersey number (optional)" placeholder="17" {...register("number")} />
        <Field label="Team join code (optional)" placeholder="IRON-4821" error={errors.code?.message} {...register("code")} />
        <div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" {...register("terms")} />
            <span>I agree to the Terms of service and Privacy policy.</span>
          </label>
          {errors.terms && <p className="mt-1 text-sm text-flag">{errors.terms.message}</p>}
        </div>
        <button disabled={isSubmitting} className="btn btn-pri w-full">{isSubmitting ? <LoadingDots label="Creating account" /> : "Create player account"}</button>
        <p role="status" className="text-sm font-medium text-brand">{message}</p>
      </form>
    </>
  );
}
