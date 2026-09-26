import test from "node:test";
import assert from "node:assert/strict";
import { decodeCursor, decodeNotificationCursor, encodeCursor, encodeNotificationCursor, notificationCursorFromRow } from "../src/pagination.js";

test("cursor round-trips stable ordering fields without precision loss", () => {
  const cursor = encodeCursor({ timestamp: "2026-09-26T10:20:30.123456Z", id: "9223372036854775807" });
  assert.deepEqual(decodeCursor(cursor), {
    timestamp: "2026-09-26T10:20:30.123456Z",
    id: "9223372036854775807"
  });
});

test("notification cursor round-trips receivedAt and id", () => {
  const cursor = encodeNotificationCursor({ receivedAt: "2026-09-26T10:20:30.123456Z", id: "42" });
  assert.deepEqual(decodeNotificationCursor(cursor), {
    receivedAt: "2026-09-26T10:20:30.123456Z",
    id: "42"
  });
});

test("notification cursor can be created from a database row", () => {
  const cursor = notificationCursorFromRow({ received_at: "2026-09-26T10:20:30.123456Z", id: "42" });
  assert.deepEqual(decodeNotificationCursor(cursor), {
    receivedAt: "2026-09-26T10:20:30.123456Z",
    id: "42"
  });
});

test("malformed cursors are rejected", () => {
  for (const value of ["", "not-base64", "e30", "eyJ2IjoyLCJ0IjoiMjAyNi0wOS0yNlQxMDoyMDozMC4xMjNaIiwiaSI6IjQyIn0"]) {
    assert.throws(() => decodeCursor(value));
  }
});

test("cursor accepts PostgreSQL timestamptz text without losing microseconds", () => {
  const timestamp = "2026-09-26 10:20:30.123456+00";
  const cursor = encodeCursor({ timestamp, id: "43" });
  assert.deepEqual(decodeCursor(cursor), { timestamp, id: "43" });
});
