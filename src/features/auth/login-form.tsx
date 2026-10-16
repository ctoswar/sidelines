"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { homeFor, signIn } from "@/lib/auth";
import { Field } from "./field";
import { LoadingDots } from "@/components/ui/loading-dots";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    const res = await signIn(data);
    setMessage(res.message);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") ? next : homeFor(res.role));
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <button disabled={isSubmitting} className="btn btn-pri w-full">{isSubmitting ? <LoadingDots label="Logging in" /> : "Log in"}</button>
        <p role="status" className="text-sm font-medium text-brand">{message}</p>
      </form>
    </>
  );
}
