import logger from "./logger.js";

const clients = new Map();
const MAX_CLIENTS_PER_PARENT = 5;
const MAX_REPLAY_EVENTS = 200;
const MAX_EVENT_PAYLOAD_BYTES = 64 * 1024;

function eventPayload(payload) {
  const data = JSON.stringify(payload ?? {});
  if (Buffer.byteLength(data, "utf8") > MAX_EVENT_PAYLOAD_BYTES) {
    throw new Error("Realtime event payload is too large");
  }
  return data;
}

export function formatSseEvent({ id, event, data, retry }) {
  const lines = [];
  if (id !== undefined && id !== null) lines.push(`id: ${String(id)}`);
  if (event) lines.push(`event: ${event}`);
  if (retry !== undefined) lines.push(`retry: ${Math.max(1000, Math.floor(retry))}`);
  lines.push(`data: ${data}`);
  return `${lines.join("\n")}\n\n`;
}

function writeEvent(res, { id, event, payload, retry }) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(formatSseEvent({ id, event, data: eventPayload(payload), retry }));
    return true;
  } catch (err) {
    logger.warn({ err, event, id: id ? String(id) : undefined }, "realtime_write_failed");
    return false;
  }
}

function writeBuffered(res, buffered) {
  const ordered = [...buffered].sort((a, b) => {
    const ai = BigInt(a.id || "0");
    const bi = BigInt(b.id || "0");
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  for (const entry of ordered) {
    if (!writeEvent(res, entry)) return false;
  }
  return true;
}

export function addClient(parentId, res, { buffering = false } = {}) {
  if (!clients.has(parentId)) clients.set(parentId, new Set());
  const set = clients.get(parentId);

  if (set.size >= MAX_CLIENTS_PER_PARENT) {
    const oldest = set.values().next().value;
    if (oldest) {
      try { oldest.res.end(); } catch {}
      set.delete(oldest);
    }
  }

  const client = { res, buffering, buffer: [] };
  set.add(client);
  const cleanup = () => removeClient(parentId, client);
  res.on("close", cleanup);
  return { cleanup, client };
}

export function removeClient(parentId, client) {
  const set = clients.get(parentId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) clients.delete(parentId);
}

export function clientCount(parentId) {
  return clients.get(parentId)?.size ?? 0;
}

export function finishReplay(client, replayThroughId = null) {
  if (!client) return;
  client.buffering = false;
  let buffered = client.buffer.splice(0);
  if (replayThroughId !== null) {
    const cutoff = BigInt(replayThroughId);
    buffered = buffered.filter(entry => entry.id == null || BigInt(entry.id) > cutoff);
  }
  if (buffered.length) writeBuffered(client.res, buffered);
}

export async function createEvent(db, parentId, event, payload) {
  const data = eventPayload(payload);
  const result = await db.query(
    `INSERT INTO realtime_events(parent_id,event_type,payload)
     VALUES($1,$2,$3::jsonb)
     RETURNING id`,
    [parentId, event, data]
  );
  return String(result.rows[0].id);
}

export async function publishEvent(db, parentId, event, payload) {
  let eventId = null;
  try {
    eventId = await createEvent(db, parentId, event, payload);
  } catch (err) {
    logger.error({ err, parentId, event }, "realtime_event_persist_failed");
  }

  const set = clients.get(parentId);
  if (set) {
    for (const client of [...set]) {
      if (client.buffering) {
        client.buffer.push({ id: eventId ?? undefined, event, payload });
        continue;
      }
      const ok = writeEvent(client.res, { id: eventId ?? undefined, event, payload });
      if (!ok) removeClient(parentId, client);
    }
  }
  return eventId;
}

export async function replayEvents(db, parentId, afterId, res, snapshotMaxId = null) {
  if (!afterId) return { replayed: 0, truncated: false };

  const minResult = await db.query(
    `SELECT MIN(id) AS min_id, MAX(id) AS max_id FROM realtime_events WHERE parent_id=$1`,
    [parentId]
  );
  const minId = minResult.rows[0]?.min_id == null ? null : BigInt(minResult.rows[0].min_id);
  const headId = minResult.rows[0]?.max_id == null ? null : BigInt(minResult.rows[0].max_id);
  const requested = BigInt(afterId);
  const snapshot = snapshotMaxId == null ? headId : BigInt(snapshotMaxId);

  if (headId !== null && requested > headId) {
    writeEvent(res, { event: "resync.required", payload: { reason: "cursor_ahead_of_head", requestedAfterId: String(requested), headId: String(headId) } });
    return { replayed: 0, truncated: true };
  }

  if (minId !== null && requested < minId - 1n) {
    writeEvent(res, {
      event: "resync.required",
      payload: {
        reason: "event_history_unavailable",
        requestedAfterId: String(requested),
        earliestAvailableId: String(minId)
      }
    });
    return { replayed: 0, truncated: true };
  }

  if (snapshot === null || requested >= snapshot) return { replayed: 0, truncated: false };

  const result = await db.query(
    `SELECT id,event_type,payload
       FROM realtime_events
      WHERE parent_id=$1 AND id>$2 AND id<=$3
      ORDER BY id ASC
      LIMIT ${MAX_REPLAY_EVENTS + 1}`,
    [parentId, requested.toString(), snapshot.toString()]
  );

  const truncated = result.rows.length > MAX_REPLAY_EVENTS;
  const rows = result.rows.slice(0, MAX_REPLAY_EVENTS);
  for (const row of rows) {
    if (!writeEvent(res, { id: String(row.id), event: row.event_type, payload: row.payload })) break;
  }
  if (truncated) {
    writeEvent(res, {
      event: "resync.required",
      payload: { reason: "replay_limit_exceeded", maxReplayEvents: MAX_REPLAY_EVENTS }
    });
  }
  return { replayed: rows.length, truncated };
}

export function streamReady(res) {
  return writeEvent(res, {
    event: "ready",
    payload: { at: new Date().toISOString() },
    retry: 3000
  });
}

export { MAX_CLIENTS_PER_PARENT, MAX_REPLAY_EVENTS };
