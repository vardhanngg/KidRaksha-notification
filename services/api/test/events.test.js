import test from "node:test";
import assert from "node:assert/strict";
import { formatSseEvent, createEvent, replayEvents, addClient, clientCount, finishReplay, publishEvent } from "../src/events.js";

function fakeResponse() {
  const listeners = new Map();
  return {
    writableEnded: false,
    destroyed: false,
    chunks: [],
    on(name, fn) { listeners.set(name, fn); return this; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end() { this.writableEnded = true; listeners.get("close")?.(); },
    emit(name) { listeners.get(name)?.(); },
  };
}

test("SSE frames carry an id, named event, retry and JSON data", () => {
  const frame = formatSseEvent({ id: "42", event: "notification", retry: 3000, data: JSON.stringify({ ok: true }) });
  assert.equal(frame, 'id: 42\nevent: notification\nretry: 3000\ndata: {"ok":true}\n\n');
});

test("createEvent persists a bounded JSON payload and returns a string id", async () => {
  const calls = [];
  const db = { query: async (...args) => { calls.push(args); return { rows: [{ id: "9001" }] }; } };
  const id = await createEvent(db, "parent-1", "device.updated", { deviceId: "device-1" });
  assert.equal(id, "9001");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], ["parent-1", "device.updated", JSON.stringify({ deviceId: "device-1" })]);
});

test("replayEvents replays parent-scoped events in ascending id order", async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes("MIN(id)")) return { rows: [{ min_id: "20", max_id: "22" }] };
      return { rows: [
        { id: "21", event_type: "notification", payload: { id: "1" } },
        { id: "22", event_type: "device.updated", payload: { deviceId: "d1" } },
      ] };
    }
  };
  const res = fakeResponse();
  const result = await replayEvents(db, "parent-1", "20", res);
  assert.deepEqual(result, { replayed: 2, truncated: false });
  assert.match(res.chunks[0], /^id: 21\nevent: notification/);
  assert.match(res.chunks[1], /^id: 22\nevent: device.updated/);
});

test("replayEvents requests a full resync when the retained history starts after the cursor", async () => {
  const db = { query: async () => ({ rows: [{ min_id: "100" }] }) };
  const res = fakeResponse();
  const result = await replayEvents(db, "parent-1", "10", res);
  assert.deepEqual(result, { replayed: 0, truncated: true });
  assert.match(res.chunks[0], /event: resync.required/);
  assert.match(res.chunks[0], /event_history_unavailable/);
});

test("addClient enforces the per-parent connection cap and cleans up on close", () => {
  const responses = Array.from({ length: 6 }, () => fakeResponse());
  const registrations = responses.map(res => addClient("parent-cap", res));
  const cleanups = registrations.map(value => value.cleanup);
  assert.equal(clientCount("parent-cap"), 5);
  responses[5].emit("close");
  assert.equal(clientCount("parent-cap"), 4);
  cleanups.forEach(cleanup => cleanup());
  assert.equal(clientCount("parent-cap"), 0);
});


test("buffered live events flush after replay without losing persisted order", async () => {
  const db = { query: async (sql, params) => {
    if (sql.includes("INSERT INTO realtime_events")) return { rows: [{ id: params[1] === "event.one" ? "101" : "102" }] };
    return { rows: [] };
  }};
  const res = fakeResponse();
  const registration = addClient("parent-buffer", res, { buffering: true });
  await publishEvent(db, "parent-buffer", "event.one", { step: 1 });
  assert.equal(res.chunks.length, 0);
  finishReplay(registration.client);
  assert.equal(res.chunks.length, 1);
  assert.match(res.chunks[0], /^id: 101\nevent: event.one/);
  registration.cleanup();
});
