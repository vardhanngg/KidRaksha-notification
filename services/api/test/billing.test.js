import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, planFor } from "../src/billing.js";

test("public billing plans are weekly and monthly only", () => {
  assert.deepEqual(Object.keys(PLANS), ["trial", "weekly", "monthly"]);
  assert.equal(PLANS.weekly.pricePaise, 7900);
  assert.equal(PLANS.weekly.devices, 1);
  assert.equal(PLANS.monthly.pricePaise, 19900);
  assert.equal(PLANS.monthly.devices, 1);
});

test("legacy plan records still resolve for existing subscriptions", () => {
  assert.equal(planFor("starter").key, "starter");
  assert.equal(planFor("family").key, "family");
});
