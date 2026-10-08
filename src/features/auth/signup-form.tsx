"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validators/auth";
import { Field } from "./field";
import { GoogleButton } from "./google-button";

export function SignupForm() {
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { terms: false },
  });

  const onSubmit = async (_data: SignupInput) => setMessage("Choose a player or organizer account to continue.");

  return (
    <>
      <GoogleButton onResult={setMessage} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        <div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" {...register("terms")} />
            <span>I agree to the Terms of service and Privacy policy.</span>
          </label>
          {errors.terms && <p className="mt-1 text-sm text-flag">{errors.terms.message}</p>}
        </div>
        <button disabled={isSubmitting} className="w-full rounded-md bg-brand py-3 font-bold text-onbrand disabled:opacity-60">
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
        <p role="status" className="text-sm font-medium text-brand">{message}</p>
      </form>
    </>
  );
}
