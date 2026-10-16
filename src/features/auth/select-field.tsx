"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { AnimatedSelect } from "@/components/dashboard/animated-select";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  error?: string;
  options: readonly string[];
};

/**
 * The signup forms' dropdown. Renders the same AnimatedSelect the player
 * signup uses — the OS-native <select> menu never matched the design —
 * bridged into react-hook-form with Controller (the button-based control
 * has no element for register's ref to attach to).
 */
export function SelectField<T extends FieldValues>({ control, name, label, options, error }: Props<T>) {
  return (
    <div>
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <div className="signup-select">
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
      </div>
      {error && <p className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
}
