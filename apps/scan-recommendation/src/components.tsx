import { ClientOnly } from "@tanstack/react-router";

import type { BloodPressure } from "#/lib/loops";

// The server and browser format dates in their own locale and time zone, so only format in the browser.
export function DateTime({ value }: { value: string }) {
  return <ClientOnly>{new Date(value).toLocaleString()}</ClientOnly>;
}

export function Time({ value }: { value: string }) {
  return (
    <ClientOnly>
      {new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </ClientOnly>
  );
}

// Loops saves categories like typical_resting_range, so show them as words: "Typical resting range".
export function label(category: string | null) {
  if (!category) return "Not measured";
  const words = category.replaceAll("_", " ");
  return words[0].toUpperCase() + words.slice(1);
}

const BLOOD_PRESSURE_STYLES: Record<BloodPressure, string> = {
  normal: "bg-emerald-100 text-emerald-800",
  elevated: "bg-amber-100 text-amber-800",
  high_blood_pressure_stage_1: "bg-orange-100 text-orange-800",
  high_blood_pressure_stage_2: "bg-red-100 text-red-700",
  hypertensive_crisis_range: "bg-red-600 text-white",
};

export function BloodPressureBadge({ value }: { value: BloodPressure | null }) {
  const style = value
    ? BLOOD_PRESSURE_STYLES[value]
    : "bg-neutral-200/70 text-neutral-700";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label(value)}
    </span>
  );
}
