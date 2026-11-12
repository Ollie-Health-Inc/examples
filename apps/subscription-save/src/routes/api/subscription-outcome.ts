import { createFileRoute } from "@tanstack/react-router";

import { recordOutcome } from "#/lib/outcomes.server";

// Set SUBSCRIPTION_WEBHOOK_URL on subscription-save-outcome to
// https://<your app>/api/subscription-outcome?key=<SUBSCRIPTION_WEBHOOK_KEY>
export const Route = createFileRoute("/api/subscription-outcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The request isn't signed, so the key in the URL is the only way to turn strangers away.
        const key = new URL(request.url).searchParams.get("key");
        const { SUBSCRIPTION_WEBHOOK_KEY } = process.env;
        if (!SUBSCRIPTION_WEBHOOK_KEY || key !== SUBSCRIPTION_WEBHOOK_KEY) {
          return new Response("Not found", { status: 404 });
        }

        const body = await request.json().catch(() => null);
        if (typeof body?.decidedAt !== "string" || !body?.outcome) {
          return Response.json(
            { error: "Expected an outcome with decidedAt" },
            { status: 400 },
          );
        }

        // Return a 2xx quickly. Anything else fails the run in the dashboard.
        await recordOutcome({
          userId: body.userId,
          reason: body.reason,
          offer: body.offer,
          outcome: body.outcome,
          details: body.details,
          decidedAt: body.decidedAt,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
