const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 512;

function assertSafeId(value) {
  const id = String(value ?? "");
  if (!/^\d{1,19}$/.test(id) || id === "0") throw new Error("Invalid pagination cursor id");
  try {
    const numeric = BigInt(id);
    if (numeric <= 0n || numeric > 9223372036854775807n) throw new Error();
  } catch {
    throw new Error("Invalid pagination cursor id");
  }
  return id;
}

function parseTimestamp(value) {
  const text = String(value ?? "").trim();
  const date = new Date(text);
  // Accept ISO-8601 as well as PostgreSQL timestamptz::text (for example, "+00").
  if (!Number.isFinite(date.getTime()) || !/[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(text)) {
    throw new Error("Invalid pagination cursor timestamp");
  }
  return text;
}

export function encodeCursor({ timestamp, id }) {
  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    t: parseTimestamp(timestamp),
    i: assertSafeId(id)
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeCursor(cursor) {
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
    throw new Error("Invalid pagination cursor");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid pagination cursor");
  }
  if (payload?.v !== CURSOR_VERSION || !payload?.t || payload?.i === undefined) {
    throw new Error("Invalid pagination cursor");
  }
  return { timestamp: parseTimestamp(payload.t), id: assertSafeId(payload.i) };
}

export function encodeNotificationCursor({ receivedAt, id }) {
  return encodeCursor({ timestamp: receivedAt, id });
}

export function decodeNotificationCursor(cursor) {
  const decoded = decodeCursor(cursor);
  return { receivedAt: decoded.timestamp, id: decoded.id };
}

export function notificationCursorFromRow(row) {
  return encodeNotificationCursor({ receivedAt: row.received_at_cursor ?? row.received_at, id: row.id });
}
