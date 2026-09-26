import test from "node:test";
import assert from "node:assert/strict";
import { effectivePlan, subscriptionAccess } from "../src/entitlements.js";

test("active paid subscription grants its configured plan", () => {
  const result = subscriptionAccess({ plan_key: "family", status: "active", current_period_end: "2026-10-10T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z"));
  assert.equal(result.state, "paid");
  assert.equal(result.entitled, true);
  assert.equal(result.plan.key, "family");
});

test("active paid subscription whose current period ended is not entitled", () => {
  const result = subscriptionAccess({ plan_key: "family", status: "active", current_period_end: "2026-09-01T00:00:00.000Z", trial_ends_at: "2026-09-05T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z"));
  assert.equal(result.state, "expired");
  assert.equal(result.entitled, false);
  assert.equal(effectivePlan({ plan_key: "family", status: "active", current_period_end: "2026-09-01T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z")).key, "trial");
});

test("unexpired trial grants only trial limits", () => {
  const result = subscriptionAccess({ plan_key: "trial", status: "trialing", trial_ends_at: "2026-09-30T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z"));
  assert.equal(result.state, "trial");
  assert.equal(result.entitled, true);
  assert.equal(result.plan.key, "trial");
});

test("expired trial has zero entitlements", () => {
  const result = subscriptionAccess({ plan_key: "trial", status: "trialing", trial_ends_at: "2026-09-20T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z"));
  assert.equal(result.state, "expired");
  assert.equal(result.entitled, false);
});

test("expired paid subscription does not fall back to an unexpired original trial", () => {
  const result = subscriptionAccess({ plan_key: "starter", status: "cancelled", current_period_end: "2026-09-01T00:00:00.000Z", trial_ends_at: "2026-09-30T00:00:00.000Z" }, new Date("2026-09-26T00:00:00.000Z"));
  assert.equal(result.state, "expired");
  assert.equal(result.entitled, false);
});
