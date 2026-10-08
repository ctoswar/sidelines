"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: readonly string[];
};

export const SelectField = forwardRef<HTMLSelectElement, Props>(function SelectField(
  { label, error, options, id, ...rest },
  ref,
) {
  const selectId = id ?? rest.name;
  return (
    <div>
      <label htmlFor={selectId} className="mb-1 block text-sm font-bold">{label}</label>
      <select ref={ref} id={selectId} defaultValue="" aria-invalid={!!error} className="inp" {...rest}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      {error && <p className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
});
