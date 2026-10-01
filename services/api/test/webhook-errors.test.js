import test from "node:test";
import assert from "node:assert/strict";
import { webhookFailureStatus } from "../src/webhook-errors.js";

test("malformed JSON is classified as a permanent webhook request error", () => {
  assert.equal(webhookFailureStatus(new SyntaxError("Unexpected token")), 400);
});

test("database and other processing failures are classified as retryable server errors", () => {
  assert.equal(webhookFailureStatus(new Error("database unavailable")), 500);
  assert.equal(webhookFailureStatus(Object.assign(new Error("connection lost"), { code: "08006" })), 500);
});
