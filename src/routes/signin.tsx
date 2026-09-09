import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Alias: /signin → /login */
export const Route = createFileRoute("/signin")({
  component: () => <Navigate to="/login" />,
});
