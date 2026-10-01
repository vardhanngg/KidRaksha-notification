import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, planFor, subscriptionTotalCountFor } from "../src/billing.js";

test("public billing plans match the configured weekly and monthly offers", () => {
  assert.deepEqual(Object.keys(PLANS), ["trial", "weekly", "monthly"]);
  assert.equal(PLANS.weekly.pricePaise, 4900);
  assert.equal(PLANS.weekly.displayPrice, "₹49 / week");
  assert.equal(PLANS.weekly.devices, 1);
  assert.equal(PLANS.monthly.pricePaise, 19900);
  assert.equal(PLANS.monthly.displayPrice, "₹199 / month");
  assert.equal(PLANS.monthly.devices, 2);
});

test("legacy plan records still resolve for existing subscriptions", () => {
  assert.equal(planFor("starter").key, "starter");
  assert.equal(planFor("family").key, "family");
});

test("Razorpay subscription duration is plan-specific", () => {
  assert.equal(subscriptionTotalCountFor("weekly"), 520);
  assert.equal(subscriptionTotalCountFor("monthly"), 120);
  assert.throws(() => subscriptionTotalCountFor("trial"), /Unsupported subscription plan/);
});
