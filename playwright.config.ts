import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:8081";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 8081",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          BETTER_AUTH_SECRET:
            process.env.BETTER_AUTH_SECRET ?? "ci-better-auth-secret-not-for-prod",
          BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseURL,
        },
      },
});
