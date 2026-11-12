import { useEffect, useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";

import { DateTime, OutcomeBadge, offerLabel, reasonLabel } from "#/components";
import { confirmCancellation, getCustomer } from "#/lib/loops";
import { getOutcomes, setOutcomeStatus } from "#/lib/outcomes";
import { planName, useSubscribers } from "#/lib/subscribers";
import type { Subscriber } from "#/lib/subscribers";

export const Route = createFileRoute("/desk")({
  loader: () => getOutcomes(),
  component: DeskPage,
});

type DeskOutcome = Awaited<ReturnType<typeof getOutcomes>>[number];

function DeskPage() {
  const outcomes = Route.useLoaderData();
  const subscribers = useSubscribers();
  const router = useRouter();

  // Outcomes arrive on the webhook in the background, so check for new ones every few seconds.
  useEffect(() => {
    const timer = setInterval(() => router.invalidate(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Store desk</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Every outcome Loops posted to this app's webhook, newest first. Apply
          each one in your billing system, and confirm cancellations so Loops
          knows they happened.
        </p>
      </section>

      {outcomes.length === 0 && (
        <p className="card text-neutral-500">
          No outcomes yet. Check SUBSCRIPTION_WEBHOOK_URL is set on
          subscription-save-outcome, then ask to cancel on a subscriber's page.
        </p>
      )}

      <ul className="space-y-3">
        {outcomes.map((outcome) => (
          <OutcomeCard
            key={outcome.key}
            outcome={outcome}
            subscriber={subscribers?.find((s) => s.id === outcome.userId)}
          />
        ))}
      </ul>
    </main>
  );
}

function OutcomeCard({
  outcome,
  subscriber,
}: {
  outcome: DeskOutcome;
  subscriber?: Subscriber;
}) {
  const router = useRouter();

  async function setApplied(applied: boolean) {
    await setOutcomeStatus({ data: { key: outcome.key, applied } });
    await router.invalidate();
  }

  return (
    <li className="card space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {outcome.userId ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: outcome.userId }}
              className="font-medium hover:underline"
            >
              {subscriber?.name || outcome.userId}
            </Link>
          ) : (
            // The agent only knows who it's talking to if the first message said so.
            <p className="font-medium">Unknown customer</p>
          )}
          <p className="text-sm text-neutral-500">
            {subscriber && `${planName(subscriber)} · `}
            <DateTime value={outcome.decidedAt} />
          </p>
        </div>
        <OutcomeBadge outcome={outcome.outcome} />
      </div>

      <p className="text-sm">
        {reasonLabel(outcome.reason)}
        <span className="text-neutral-400"> → </span>
        {offerLabel(outcome.offer)}
      </p>
      {outcome.details && (
        <p className="text-sm text-neutral-700">{outcome.details}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={outcome.applied}
            onChange={(event) => setApplied(event.target.checked)}
            className="size-4 accent-brand"
          />
          Applied in billing
        </label>
        {outcome.outcome === "cancelled" && outcome.userId && (
          <ConfirmCancellation outcome={outcome} subscriber={subscriber} />
        )}
      </div>
    </li>
  );
}

function ConfirmCancellation({
  outcome,
  subscriber,
}: {
  outcome: DeskOutcome;
  subscriber?: Subscriber;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "waiting" | "timed-out">(
    "idle",
  );
  const [error, setError] = useState("");
  const customerId = outcome.userId!;

  async function confirm() {
    setStatus("waiting");
    setError("");

    try {
      const before = (await getCustomer({ data: customerId }))?.metadata
        .subscription?.cancelledAt;
      await confirmCancellation({
        data: {
          customerId,
          reason: outcome.details || reasonLabel(outcome.reason),
          // The store knows the plan and phone. Loops doesn't, until now.
          ...(subscriber && { plan: planName(subscriber) }),
          ...(subscriber?.phone && { phone: subscriber.phone }),
        },
      });

      // Triggering only starts the workflow, so check for the cancellation for up to 30 seconds.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const latest = await getCustomer({ data: customerId });
        if (latest?.metadata.subscription?.cancelledAt !== before) {
          await setOutcomeStatus({
            data: { key: outcome.key, cancellationConfirmed: true },
          });
          await router.invalidate();
          setStatus("idle");
          return;
        }
      }
      setStatus("timed-out");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  if (outcome.cancellationConfirmed) {
    return <p className="text-neutral-500">Cancellation recorded in Loops</p>;
  }

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-red-600">{error}</p>}
      {status === "timed-out" && (
        <p className="text-red-600">
          Not in Loops after 30 seconds. Check the subscription-cancelled run.
        </p>
      )}
      <button
        onClick={confirm}
        disabled={status === "waiting"}
        className="button px-4 py-2"
      >
        {status === "waiting" ? "Confirming…" : "Confirm cancellation"}
      </button>
    </div>
  );
}
