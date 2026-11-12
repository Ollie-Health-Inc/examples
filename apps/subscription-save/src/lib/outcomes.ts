import { createServerFn } from "@tanstack/react-start";

import { outcomeKey, readOutcomes, updateOutcome } from "#/lib/outcomes.server";

export type { StoredOutcome } from "#/lib/outcomes.server";

// Every outcome the webhook received, newest first. Loops only keeps the latest one per customer.
export const getOutcomes = createServerFn({ method: "GET" }).handler(async () =>
  (await readOutcomes())
    .map((outcome) => ({ ...outcome, key: outcomeKey(outcome) }))
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)),
);

export const setOutcomeStatus = createServerFn({ method: "POST" })
  .validator(
    (data: {
      key: string;
      applied?: boolean;
      cancellationConfirmed?: boolean;
    }) => data,
  )
  .handler(({ data: { key, ...change } }) => updateOutcome(key, change));
