import { createFileRoute } from "@tanstack/react-router";

import { recordArrival } from "#/lib/arrivals.server";

// clinic-intake-record posts here when BOOKING_WEBHOOK_URL points at this route.
// The request isn't signed, so the secret token in the path is the only check.
export const Route = createFileRoute("/api/booking-requests/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = process.env.BOOKING_WEBHOOK_TOKEN;
        if (!token || params.token !== token) {
          return new Response("Not found", { status: 404 });
        }

        // Only keep the id. The clinic page reads the details from Loops rather than trusting this body.
        const body = await request.json().catch(() => null);
        if (typeof body?.patientId !== "string") {
          return Response.json(
            { error: "Expected { patientId }" },
            { status: 400 },
          );
        }

        await recordArrival(body.patientId);
        return Response.json({ ok: true });
      },
    },
  },
});
