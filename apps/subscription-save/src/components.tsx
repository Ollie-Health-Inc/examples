import { ClientOnly } from "@tanstack/react-router";

import type { Offer, Outcome, Reason } from "#/lib/loops";

// The server and browser format dates in their own locale and time zone, so only format in the browser.
export function DateTime({ value }: { value: string }) {
  return <ClientOnly>{new Date(value).toLocaleString()}</ClientOnly>;
}

export function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-neutral-700">
      {children}
    </span>
  );
}

const REASONS: Record<Reason, string> = {
  too_expensive: "Too expensive",
  too_much_product: "Too much product",
  not_feeling_a_difference: "Not feeling a difference",
  taste_or_format: "Taste or format",
  travel_or_moving: "Travel or moving",
  other: "Other",
};

const OFFERS: Record<Offer, string> = {
  pause: "Pause",
  skip_next: "Skip next delivery",
  swap_product: "Swap product",
  change_frequency: "Change frequency",
  none: "No offer",
};

export function reasonLabel(reason: Reason) {
  return REASONS[reason] ?? reason;
}

export function offerLabel(offer: Offer) {
  return OFFERS[offer] ?? offer;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return outcome === "stayed" ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      Stayed
    </span>
  ) : (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Cancelling
    </span>
  );
}
