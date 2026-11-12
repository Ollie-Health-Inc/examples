import { ClientOnly } from "@tanstack/react-router";

import type { Band, BloodPressure } from "#/lib/loops";

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

// Loops saves categories like healthy_weight, so show them as words: "Healthy weight".
export function label(category: string | null) {
  if (!category) return "Not measured";
  const words = category.replaceAll("_", " ");
  return words[0].toUpperCase() + words.slice(1);
}

const BLOOD_PRESSURE: Record<BloodPressure, [words: string, style: string]> = {
  normal: ["Normal", "bg-emerald-100 text-emerald-800"],
  elevated: ["Elevated", "bg-amber-100 text-amber-800"],
  high_blood_pressure_stage_1: [
    "Stage 1 high blood pressure",
    "bg-orange-100 text-orange-800",
  ],
  high_blood_pressure_stage_2: [
    "Stage 2 high blood pressure",
    "bg-red-100 text-red-700",
  ],
  hypertensive_crisis_range: ["Crisis range", "bg-red-600 text-white"],
};

export function BloodPressureBadge({ value }: { value: BloodPressure | null }) {
  const [words, style] = value
    ? BLOOD_PRESSURE[value]
    : ["Not measured", "bg-neutral-200/70 text-neutral-700"];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {words}
    </span>
  );
}

const BAND_STYLES: Record<Band, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  steady: "bg-sand text-neutral-800",
  "room to improve": "bg-orange-100 text-orange-800",
};

export function BandBadge({ band }: { band: Band | null }) {
  if (!band) return null;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[band]}`}
    >
      {band[0].toUpperCase() + band.slice(1)}
    </span>
  );
}
