import { ClientOnly } from "@tanstack/react-router";

import type { Decision, Resolution } from "#/lib/loops";

// The server and browser format dates in their own locale and time zone, so only format in the browser.
export function DateTime({ value }: { value: string }) {
  return <ClientOnly>{new Date(value).toLocaleString()}</ClientOnly>;
}

const DECISION_STYLES: Record<Decision, string> = {
  eligible: "bg-emerald-100 text-emerald-800",
  needs_approval: "bg-amber-100 text-amber-800",
  not_eligible: "bg-red-100 text-red-700",
};

// Loops saves raw values like needs_approval, so show them as words.
export function words(value: Decision | Resolution) {
  return value.replace("_", " ");
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DECISION_STYLES[decision]}`}
    >
      {words(decision)}
    </span>
  );
}
