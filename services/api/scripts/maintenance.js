import "dotenv/config";
import pg from "pg";
import logger from "../src/logger.js";

const { Pool } = pg;
const INTERVAL_MS = Number(process.env.MAINTENANCE_INTERVAL_MS || 60 * 60 * 1000);
const LOCK_KEY_1 = 0x4b4452;
const LOCK_KEY_2 = 0x4d4149;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

async function runMaintenance() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query("SELECT pg_try_advisory_xact_lock($1,$2) AS acquired", [LOCK_KEY_1, LOCK_KEY_2]);
    if (!lock.rows[0].acquired) {
      await client.query("ROLLBACK");
      return { skipped: true };
    }
    const purge = await client.query("SELECT purge_expired_notifications() AS deleted_notifications");
    const sessions = await client.query("DELETE FROM sessions WHERE expires_at < now() OR last_seen_at < now()-interval '8 hours'");
    const pairing = await client.query("DELETE FROM pairing_codes WHERE used_at IS NOT NULL OR expires_at < now()-interval '1 day'");
    const realtime = await client.query("DELETE FROM realtime_events WHERE created_at < now()-make_interval(days => $1)", [7]);
    const passwordReset = await client.query("DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < now()-interval '1 day'");
    const revoked = await client.query("UPDATE devices SET sharing_enabled=false,content_sharing_enabled=false,updated_at=now() WHERE revoked_at IS NOT NULL AND (sharing_enabled OR content_sharing_enabled)");
    await client.query("COMMIT");
    return {
      deletedNotifications: Number(purge.rows[0]?.deleted_notifications || 0),
      sessions: sessions.rowCount || 0,
      pairingCodes: pairing.rowCount || 0,
      realtimeEvents: realtime.rowCount || 0,
      passwordResetTokens: passwordReset.rowCount || 0,
      revokedDevices: revoked.rowCount || 0,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

let stopping = false;
async function tick() {
  if (stopping) return;
  const started = Date.now();
  try {
    const result = await runMaintenance();
    logger.info({ ...result, durationMs: Date.now() - started }, "maintenance_completed");
  } catch (err) {
    logger.error({ err, durationMs: Date.now() - started }, "maintenance_failed");
  }
}

await tick();
const timer = setInterval(() => void tick(), INTERVAL_MS);
timer.unref();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  logger.info({ signal }, "maintenance_shutdown");
  await pool.end();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
