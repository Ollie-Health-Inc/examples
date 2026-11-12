import { ClientOnly } from "@tanstack/react-router";

import type { Urgency } from "#/lib/loops";

// The server and browser format dates in their own locale and time zone, so only format in the browser.
export function DateTime({ value }: { value: string }) {
  return <ClientOnly>{new Date(value).toLocaleString()}</ClientOnly>;
}

const URGENCY_STYLES: Record<Urgency, string> = {
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  routine: "bg-neutral-200/70 text-neutral-700",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${URGENCY_STYLES[urgency]}`}
    >
      {urgency}
    </span>
  );
}

export function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-neutral-700">
      {children}
    </span>
  );
}

// Memory lines are plain text, so turn the hospital map links into real links.
export function LinkifiedText({ text }: { text: string }) {
  return text.split(/(https?:\/\/\S+)/).map((part, index) =>
    part.startsWith("http") ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        map
      </a>
    ) : (
      part
    ),
  );
}
