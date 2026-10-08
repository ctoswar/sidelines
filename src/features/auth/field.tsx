"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, id, type, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputId = id ?? rest.name;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-bold">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && show ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className={`w-full rounded-md border border-line bg-card px-4 py-3 ${isPassword ? "pr-20" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-sm font-medium text-muted"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p id={`${inputId}-err`} className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
});
