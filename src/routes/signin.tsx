// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-1.0

import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Alias: /signin → /login */
export const Route = createFileRoute("/signin")({
  component: () => <Navigate to="/login" />,
});
