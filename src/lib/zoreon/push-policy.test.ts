import assert from "node:assert/strict";
import test from "node:test";
import { isSubscriptionGone, resolveVapidSubject } from "./push-policy.ts";

test("only 404/410 drop a subscription", () => {
  assert.equal(isSubscriptionGone({ statusCode: 410 }), true);
  assert.equal(isSubscriptionGone({ statusCode: 404 }), true);
  assert.equal(isSubscriptionGone({ statusCode: 500 }), false);
  assert.equal(isSubscriptionGone(new Error("ECONNRESET")), false);
  assert.equal(isSubscriptionGone(null), false);
});

test("vapid subject falls back when VAPID_SUBJECT is unset", () => {
  assert.equal(resolveVapidSubject({ VAPID_SUBJECT: "mailto:a@b.c" }), "mailto:a@b.c");
  assert.equal(resolveVapidSubject({ BETTER_AUTH_URL: "https://z.example" }), "https://z.example");
  assert.match(resolveVapidSubject({ BETTER_AUTH_URL: "http://localhost" }), /^mailto:/);
  assert.match(resolveVapidSubject({}), /^mailto:/);
});
