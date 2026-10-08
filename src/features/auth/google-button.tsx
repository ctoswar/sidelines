"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { LoadingDots } from "@/components/ui/loading-dots";

export function GoogleButton({ onResult }: { onResult: (m: string) => void }) {
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    onResult((await signInWithGoogle()).message);
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-line bg-card py-3 font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
          <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
          <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {loading ? <LoadingDots label="Connecting" /> : "Continue with Google"}
      </button>
      <p className="my-5 text-center text-sm text-muted">or use your email</p>
    </>
  );
}
