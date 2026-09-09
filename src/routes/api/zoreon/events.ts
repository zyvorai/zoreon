import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import type { ZoreonEvent } from "@/lib/zoreon/realtime.server";

export const Route = createFileRoute("/api/zoreon/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getSessionUser } = await import("@/lib/auth/verify.server");
        const user = await getSessionUser();
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { subscribeRealtime } = await import("@/lib/zoreon/realtime.server");
        const clientId = randomBytes(8).toString("hex");
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const send = (ev: ZoreonEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
              } catch {
                /* closed */
              }
            };
            send({ type: "ping", at: Date.now() });
            const unsub = subscribeRealtime({
              id: clientId,
              email: user.email,
              send,
            });
            const ping = setInterval(() => send({ type: "ping", at: Date.now() }), 25000);
            request.signal.addEventListener("abort", () => {
              clearInterval(ping);
              unsub();
              try {
                controller.close();
              } catch {
                /* */
              }
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
