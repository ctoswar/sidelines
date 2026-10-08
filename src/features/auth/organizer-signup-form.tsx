"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { organizerSignupSchema, orgTypes, volumes, type OrganizerSignupInput } from "@/lib/validators/auth";
import { homeFor, signUp } from "@/lib/auth";
import { Field } from "./field";
import { SelectField } from "./select-field";
import { GoogleButton } from "./google-button";
import { LoadingDots } from "@/components/ui/loading-dots";

export function OrganizerSignupForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrganizerSignupInput>({
    resolver: zodResolver(organizerSignupSchema),
    defaultValues: { terms: false },
  });

  const onSubmit = async (data: OrganizerSignupInput) => {
    const res = await signUp("organizer", data);
    setMessage(res.message);
    if (res.ok) router.push(homeFor("organizer"));
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
        <p className="font-bold">Organization details</p>
        <Field label="Organization name" placeholder="Harbor Ultimate" error={errors.org?.message} {...register("org")} />
        <SelectField label="Organization type" options={orgTypes} error={errors.orgType?.message} {...register("orgType")} />
        <Field label="Your role" placeholder="Tournament director" error={errors.title?.message} {...register("title")} />
        <SelectField label="Tournaments you run per year" options={volumes} error={errors.volume?.message} {...register("volume")} />
        <Field label="City and country" placeholder="Manila, Philippines" error={errors.city?.message} {...register("city")} />
        <Field label="Website or social page (optional)" placeholder="https://" {...register("site")} />
        <div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-1" {...register("terms")} />
            <span>I agree to the Terms of service and Privacy policy.</span>
          </label>
          {errors.terms && <p className="mt-1 text-sm text-flag">{errors.terms.message}</p>}
        </div>
        <p className="rounded-md border border-line bg-card p-3 text-sm text-muted">
          Organizer accounts get a quick review (usually within a day) before you can publish a tournament publicly. You can start setting up right away.
        </p>
        <button disabled={isSubmitting} className="btn btn-pri w-full">{isSubmitting ? <LoadingDots label="Creating account" /> : "Create organizer account"}</button>
        <p role="status" className="text-sm font-medium text-brand">{message}</p>
      </form>
    </>
  );
}
