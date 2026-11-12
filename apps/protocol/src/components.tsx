import { ClientOnly } from "@tanstack/react-router";

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
