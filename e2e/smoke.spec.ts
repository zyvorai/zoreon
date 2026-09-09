import { test, expect } from "@playwright/test";

test.describe("Zoreon smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/sign in methods/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("home redirects or shows shell", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok() || res?.status() === 200 || res?.status() === 302).toBeTruthy();
    // Unauthenticated users typically land on login or gated desktop
    await expect(page.locator("body")).toBeVisible();
  });

  test("service worker asset is reachable", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(10);
  });

  test("SSE requires auth", async ({ request }) => {
    const res = await request.get("/api/zoreon/events");
    expect(res.status()).toBe(401);
  });

  test("RTC signaling responds", async ({ request }) => {
    const res = await request.get("/api/rtc?room=e2e&peer=p1&name=t&since=0");
    expect(res.status()).toBe(200);
  });
});
