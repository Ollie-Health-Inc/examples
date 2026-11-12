import { ClientOnly } from "@tanstack/react-router";

import type { Flag, LabResult } from "#/lib/samples";

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

const FLAG_STYLES: Record<Flag, string> = {
  normal: "bg-neutral-200/70 text-neutral-700",
  low: "bg-amber-100 text-amber-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-600 text-white",
};

export function FlagBadge({ flag }: { flag: Flag }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FLAG_STYLES[flag]}`}
    >
      {flag}
    </span>
  );
}

export function ResultsTable({ results }: { results: LabResult[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-neutral-500">
        <tr>
          <th className="pb-2 font-normal">Test</th>
          <th className="pb-2 font-normal">Value</th>
          <th className="pb-2 font-normal">Range</th>
          <th className="pb-2 text-right font-normal">Flag</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result, index) => (
          <tr key={index} className="border-t border-neutral-100">
            <td className="py-2.5 pr-3 font-medium">{result.name}</td>
            <td className="py-2.5 pr-3">
              {result.value} {result.unit}
            </td>
            <td className="py-2.5 pr-3 text-neutral-500">
              {result.referenceRange || "Not given"}
            </td>
            <td className="py-2.5 text-right">
              <FlagBadge flag={result.flag} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
