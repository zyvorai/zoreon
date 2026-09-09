import { createFileRoute } from "@tanstack/react-router";
import { handleSignaling } from "@/lib/multiplayer/signaling.server";

const handle = ({ request }: { request: Request }) => handleSignaling(request);

export const Route = createFileRoute("/api/rtc")({
  server: { handlers: { GET: handle, POST: handle } },
});
