
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import crypto from "node:crypto";
import { z } from "zod";
import { pool, tx } from "./db.js";
import { createSession, getSession, deleteSession, refreshSessionActivity, cookieOptions, publicCsrfCookieOptions, COOKIE_NAME, CSRF_COOKIE, passwordHash, passwordMatches, passwordNeedsRehash, reauthenticate, hasRecentReauthentication } from "./auth.js";
import { randomToken, sha256, encryptText, decryptText, timingSafeEqualHex } from "./crypto.js";
import { addClient, clientCount, finishReplay, publishEvent, replayEvents, streamReady } from "./events.js";
import logger from "./logger.js";
import { createRateLimiters, closeRateLimiter, waitForRateLimiter, rateLimiterHealth } from "./rate-limit.js";
import { decodeCursor, decodeNotificationCursor, encodeCursor, notificationCursorFromRow } from "./pagination.js";
import { PLANS, planFor, planFromProviderId, subscriptionTotalCountFor, hmacSha256, createRazorpaySubscription } from "./billing.js";
import { effectivePlan, subscriptionAccess } from "./entitlements.js";
import { sendPasswordResetEmail, validateEmailConfig } from "./email.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const API_VERSION = "1";
const API_CONTRACT_VERSION = "7";
const DEVICE_ONLINE_WINDOW_MS = 30 * 60 * 1000;
const REALTIME_EVENT_RETENTION_DAYS = 7;
const REALTIME_MAX_SINCE_ID_DIGITS = 19;
const MAX_POSTGRES_BIGINT = 9223372036854775807n;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer" },
  hsts: process.env.NODE_ENV === "production" ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false
}));

const allowedOrigin = process.env.PUBLIC_WEB_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use((req, res, next) => {
  const supplied = String(req.header("x-request-id") || "").trim();
  const requestId = /^[A-Za-z0-9._:-]{1,80}$/.test(supplied) ? supplied : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      parentId: req.auth?.parent_id || undefined,
      deviceId: req.device?.id || undefined
    }, "http_request");
  });
  next();
});

app.post("/v1/billing/webhook", express.raw({ type: "application/json", limit: "256kb" }), handleBillingWebhook);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/v1/")) res.setHeader("Cache-Control", "no-store");
  next();
});

const rateLimiters = createRateLimiters();
const authLimiter = rateLimiters.authLimiter;
const pairingLimiter = rateLimiters.pairingLimiter;
const deviceLimiter = rateLimiters.deviceLimiter;
const parentApiLimiter = rateLimiters.parentApiLimiter;
const eventStreamLimiter = rateLimiters.eventStreamLimiter;

function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "DATA_ENCRYPTION_KEY", "PAIRING_CODE_SECRET", "RAZORPAY_WEBHOOK_SECRET", "PUBLIC_WEB_ORIGIN", "REDIS_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
  let key;
  try { key = Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64"); } catch { throw new Error("DATA_ENCRYPTION_KEY must be valid base64"); }
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  if (process.env.DATA_ENCRYPTION_KEY_PREVIOUS) {
    let previous;
    try { previous = Buffer.from(process.env.DATA_ENCRYPTION_KEY_PREVIOUS, "base64"); } catch { throw new Error("DATA_ENCRYPTION_KEY_PREVIOUS must be valid base64"); }
    if (previous.length !== 32) throw new Error("DATA_ENCRYPTION_KEY_PREVIOUS must decode to exactly 32 bytes");
  }
  if (process.env.PAIRING_CODE_SECRET.length < 32) throw new Error("PAIRING_CODE_SECRET must be at least 32 characters");
  if (process.env.RAZORPAY_WEBHOOK_SECRET.length < 16) throw new Error("RAZORPAY_WEBHOOK_SECRET must be at least 16 characters");
  validateEmailConfig();
  let origin;
  try { origin = new URL(process.env.PUBLIC_WEB_ORIGIN); } catch { throw new Error("PUBLIC_WEB_ORIGIN must be a valid URL"); }
  if (origin.protocol !== "https:") throw new Error("PUBLIC_WEB_ORIGIN must use HTTPS in production");
}

validateRuntimeConfig();

async function healthHandler(req, res) {
  const started = process.hrtime.bigint();
  try {
    await pool.query("SELECT 1");
    const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
    res.json({
      ok: true,
      service: "kidraksha-api",
      apiVersion: API_VERSION,
      time: new Date().toISOString(),
      database: { status: "ok", latencyMs: Number(latencyMs.toFixed(2)) },
      requestId: req.requestId
    });
  } catch {
    res.status(503).json({ ok: false, service: "kidraksha-api", database: { status: "unavailable" }, requestId: req.requestId });
  }
}
app.get("/health/live", (_req, res) => {
  res.json({ ok: true, service: "kidraksha-api", status: "alive", requestId: _req.requestId });
});

async function readinessHandler(req, res) {
  const started = process.hrtime.bigint();
  let database = { status: "ok", latencyMs: 0 };
  let redis = { configured: false, status: "disabled" };
  try {
    const dbStarted = process.hrtime.bigint();
    await pool.query("SELECT 1");
    database.latencyMs = Number((Number(process.hrtime.bigint() - dbStarted) / 1e6).toFixed(2));
    redis = await rateLimiterHealth();
    const ready = database.status === "ok" && (!redis.configured || redis.status === "ok");
    return res.status(ready ? 200 : 503).json({
      ok: ready,
      service: "kidraksha-api",
      status: ready ? "ready" : "not_ready",
      database,
      redis,
      latencyMs: Number((Number(process.hrtime.bigint() - started) / 1e6).toFixed(2)),
      requestId: req.requestId
    });
  } catch {
    return res.status(503).json({
      ok: false,
      service: "kidraksha-api",
      status: "not_ready",
      database: { status: "unavailable" },
      redis,
      requestId: req.requestId
    });
  }
}

app.get("/health/ready", readinessHandler);
app.get("/v1/health/ready", readinessHandler);
app.get("/health", healthHandler);
app.get("/v1/health", healthHandler);
app.get("/v1/meta", (_req, res) => {
  res.json({
    apiVersion: API_VERSION,
    contractVersion: API_CONTRACT_VERSION,
    service: "kidraksha-api",
    features: {
      notificationCursorPagination: true,
      notificationSearch: true,
      notificationBulkActions: true,
      deviceLifecycle: true,
      auditLog: true,
      structuredRequestIds: true,
      realtimeEventReplay: true,
      realtimeConnectionCaps: true,
      hashedCsrfTokens: true,
      secureSessionCookies: true,
      recentReauthentication: true,
      passwordRotation: true,
      sensitiveExportReauthentication: true,
      distributedRateLimits: Boolean(process.env.REDIS_URL)
    },
    realtime: { maxConnectionsPerParent: 5, maxReplayEvents: 200, retentionDays: REALTIME_EVENT_RETENTION_DAYS },
    limits: { notificationPageSize: 100, notificationBulkSize: 100, notificationUploadBatchSize: 50 }
  });
});

app.post("/v1/auth/signup", authLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(200).transform(v => v.trim().toLowerCase()),
      password: z.string().min(10).max(128),
      displayName: z.string().trim().min(1).max(80),
      acceptedPolicies: z.literal(true)
    }).parse(req.body);

    const exists = await pool.query("SELECT 1 FROM parents WHERE email=$1", [input.email]);
    if (exists.rowCount) return sendError(res, req, 409, "An account with that email already exists.", "account_exists");

    const id = crypto.randomUUID();
    const result = await tx(async client => {
      await client.query(
        "INSERT INTO parents(id,email,password_hash,display_name,terms_accepted_at,privacy_accepted_at) VALUES($1,$2,$3,$4,now(),now())",
        [id, input.email, passwordHash(input.password), input.displayName]
      );
      await client.query(
        `INSERT INTO subscriptions(id,parent_id,plan_key,status,trial_ends_at)
         VALUES($1,$2,'trial','trialing',now()+interval '7 days')`,
        [crypto.randomUUID(), id]
      );
      await client.query(
        `INSERT INTO audit_log(parent_id,actor_type,action,metadata) VALUES($1,'parent','account_created',$2)`,
        [id, JSON.stringify({ policiesAccepted: true })]
      );
      return createSession(client, id);
    });

    setSessionCookies(res, result);
    res.status(201).json({ user: { id, email: input.email, displayName: input.displayName } });
  } catch (err) { next(err); }
});

app.post("/v1/auth/login", authLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(200).transform(v => v.trim().toLowerCase()),
      password: z.string().min(1).max(128)
    }).parse(req.body);

    const { rows } = await pool.query("SELECT id,email,password_hash,display_name FROM parents WHERE email=$1", [input.email]);
    const parent = rows[0];
    if (!parent || !passwordMatches(input.password, parent.password_hash)) {
      return sendError(res, req, 401, "Invalid email or password.", "invalid_credentials");
    }

    if (passwordNeedsRehash(parent.password_hash)) {
      await pool.query("UPDATE parents SET password_hash=$1,updated_at=now() WHERE id=$2", [passwordHash(input.password), parent.id]);
    }
    const session = await createSession(pool, parent.id);
    await audit(parent.id, null, "login", {});
    setSessionCookies(res, session);
    res.json({ user: { id: parent.id, email: parent.email, displayName: parent.display_name } });
  } catch (err) { next(err); }
});

app.post("/v1/auth/password-reset/request", authLimiter, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(200).transform(v => v.trim().toLowerCase()) }).strict().parse(req.body);
    const { rows } = await pool.query("SELECT id,email FROM parents WHERE email=$1", [input.email]);
    if (rows[0]) {
      const token = randomToken(32);
      await tx(async client => {
        await client.query("UPDATE password_reset_tokens SET used_at=now() WHERE parent_id=$1 AND used_at IS NULL", [rows[0].id]);
        await client.query(
          `INSERT INTO password_reset_tokens(id,parent_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')`,
          [crypto.randomUUID(), rows[0].id, sha256(token)]
        );
        await client.query(
          `INSERT INTO audit_log(parent_id,actor_type,action,metadata) VALUES($1,'parent','password_reset_requested',$2)`,
          [rows[0].id, JSON.stringify({ delivery: "email" })]
        );
      });
      try {
        await sendPasswordResetEmail({ to: rows[0].email, token });
      } catch (err) {
        logger.error({ err }, "password_reset_email_failed");
      }
    }
    // Deliberately identical response for existing/non-existing accounts.
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, message: "If an account exists for that email, a password reset link has been sent." });
  } catch (err) { next(err); }
});

app.post("/v1/auth/password-reset/confirm", authLimiter, async (req, res, next) => {
  let client;
  try {
    const input = z.object({ token: z.string().min(32).max(256), newPassword: z.string().min(10).max(128) }).strict().parse(req.body);
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT prt.id,prt.parent_id,p.password_hash
         FROM password_reset_tokens prt
         JOIN parents p ON p.id=prt.parent_id
        WHERE prt.token_hash=$1 AND prt.used_at IS NULL AND prt.expires_at>now()
        FOR UPDATE`,
      [sha256(input.token)]
    );
    const reset = rows[0];
    if (!reset) {
      await client.query("ROLLBACK");
      return sendError(res, req, 400, "This reset link is invalid or expired.", "password_reset_invalid");
    }
    if (passwordMatches(input.newPassword, reset.password_hash)) {
      await client.query("ROLLBACK");
      return sendError(res, req, 400, "Choose a password that is different from your current password.", "password_reuse");
    }
    await client.query("UPDATE parents SET password_hash=$1,updated_at=now() WHERE id=$2", [passwordHash(input.newPassword), reset.parent_id]);
    await client.query("DELETE FROM sessions WHERE parent_id=$1", [reset.parent_id]);
    await client.query("UPDATE password_reset_tokens SET used_at=now() WHERE parent_id=$1 AND used_at IS NULL", [reset.parent_id]);
    await client.query(
      `INSERT INTO audit_log(parent_id,actor_type,action,metadata) VALUES($1,'parent','password_reset_completed',$2)`,
      [reset.parent_id, JSON.stringify({ sessionsRevoked: true })]
    );
    await client.query("COMMIT");
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) {
    if (client) { try { await client.query("ROLLBACK"); } catch {} }
    next(err);
  } finally {
    client?.release();
  }
});

app.post("/v1/auth/logout", requireParent, requireCsrf, async (req, res, next) => {
  try {
    await audit(req.auth.parent_id, null, "logout", {});
    await deleteSession(pool, req.cookies?.[COOKIE_NAME]);
    clearSessionCookies(res);
    res.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/v1/auth/password", authLimiter, requireParent, requireCsrf, async (req, res, next) => {
  let client = null;
  try {
    const input = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(10).max(128)
    }).strict().parse(req.body);
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT password_hash FROM parents WHERE id=$1 FOR UPDATE", [req.auth.parent_id]);
    if (!rows[0] || !passwordMatches(input.currentPassword, rows[0].password_hash)) {
      await client.query("ROLLBACK");
      return sendError(res, req, 401, "The current password is incorrect.", "password_change_failed");
    }
    if (passwordMatches(input.newPassword, rows[0].password_hash)) {
      await client.query("ROLLBACK");
      return sendError(res, req, 400, "Choose a new password that is different from your current password.", "password_reuse");
    }
    const nextHash = passwordHash(input.newPassword);
    await client.query("UPDATE parents SET password_hash=$1,updated_at=now() WHERE id=$2", [nextHash, req.auth.parent_id]);
    await client.query("DELETE FROM sessions WHERE parent_id=$1", [req.auth.parent_id]);
    const session = await createSession(client, req.auth.parent_id);
    await client.query(
      `INSERT INTO audit_log(parent_id,actor_type,action,metadata) VALUES($1,'parent','password_changed',$2)`,
      [req.auth.parent_id, JSON.stringify({ sessionsRevoked: true })]
    );
    await client.query("COMMIT");
    setSessionCookies(res, session);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) {
    if (client) { try { await client.query("ROLLBACK"); } catch {} }
    next(err);
  } finally {
    client?.release();
  }
});

app.get("/v1/auth/session", requireParent, async (req, res) => {
  res.json({
    user: {
      id: req.auth.parent_id,
      email: req.auth.email,
      displayName: req.auth.display_name,
      retentionDays: req.auth.retention_days
    }
  });
});

app.post("/v1/auth/reauth", authLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const password = z.object({ password: z.string().min(1).max(128) }).parse(req.body).password;
    const { rows } = await pool.query("SELECT password_hash FROM parents WHERE id=$1", [req.auth.parent_id]);
    if (!rows[0] || !await reauthenticate(pool, req.auth.id, password, rows[0].password_hash)) {
      return sendError(res, req, 401, "The current password is incorrect.", "reauthentication_failed");
    }
    await audit(req.auth.parent_id, null, "reauthenticated", {});
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, expiresInSeconds: 15 * 60 });
  } catch (err) { next(err); }
});

app.get("/v1/dashboard/summary", requireParent, async (req, res, next) => {
  try {
    const parentId = req.auth.parent_id;
    const [counts, devices, latest, plan] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND read_at IS NULL) AS unread,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND received_at >= now()-interval '24 hours') AS today
         FROM notifications WHERE parent_id=$1`, [parentId]),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE revoked_at IS NULL AND last_seen_at>=now()-interval '30 minutes')::int AS online
           FROM devices WHERE parent_id=$1`, [parentId]),
      getNotifications(parentId, { limit: 8 }),
      getSubscription(parentId)
    ]);
    res.json({
      counts: counts.rows[0],
      devices: devices.rows[0],
      latest: latest.items,
      plan
    });
  } catch (err) { next(err); }
});

app.get("/v1/notifications", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const input = parseNotificationListQuery(req.query);
    const result = await getNotifications(req.auth.parent_id, input);
    res.json(result);
  } catch (err) { next(err); }
});

app.get("/v1/notifications/:id", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const id = parseBigIntId(req.params.id);
    const { rows } = await pool.query(
      `SELECT n.id,n.package_name,n.app_name,n.notification_type,n.category,n.channel_id,n.group_key,
              n.is_ongoing,n.is_clearable,n.is_group_summary,n.content_state,n.title_enc,n.body_enc,
              n.posted_at,n.received_at,n.read_at,d.id AS device_id,d.name AS device_name
         FROM notifications n
         JOIN devices d ON d.id=n.device_id
        WHERE n.id=$1 AND n.parent_id=$2 AND n.deleted_at IS NULL`,
      [id, req.auth.parent_id]
    );
    if (!rows[0]) return sendError(res, req, 404, "Notification not found.", "notification_not_found");
    res.json({ notification: serializeNotification(rows[0]) });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/:id/read", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = parseBigIntId(req.params.id);
    const result = await pool.query(
      `UPDATE notifications SET read_at=COALESCE(read_at,now())
       WHERE id=$1 AND parent_id=$2 AND deleted_at IS NULL RETURNING id,read_at`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Notification not found.", "notification_not_found");
    await publishEvent(pool, req.auth.parent_id, "notification.read", { id: String(result.rows[0].id), readAt: result.rows[0].read_at, changedAt: result.rows[0].read_at });
    res.json({ ok: true, id: String(result.rows[0].id), readAt: result.rows[0].read_at });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/:id/unread", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = parseBigIntId(req.params.id);
    const result = await pool.query(
      `UPDATE notifications SET read_at=NULL
       WHERE id=$1 AND parent_id=$2 AND deleted_at IS NULL RETURNING id`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Notification not found.", "notification_not_found");
    await publishEvent(pool, req.auth.parent_id, "notification.unread", { id: String(result.rows[0].id), changedAt: new Date().toISOString() });
    res.json({ ok: true, id: String(result.rows[0].id), readAt: null });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/bulk-read", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const ids = parseNotificationIds(req.body);
    const result = await pool.query(
      `UPDATE notifications SET read_at=COALESCE(read_at,now())
       WHERE parent_id=$1 AND id=ANY($2::bigint[]) AND deleted_at IS NULL
       RETURNING id,read_at`,
      [req.auth.parent_id, ids]
    );
    await audit(req.auth.parent_id, null, "notifications_bulk_read", { requested: ids.length, updated: result.rowCount });
    await publishEvent(pool, req.auth.parent_id, "notifications.bulk-read", { ids: result.rows.map(row => String(row.id)), count: result.rowCount, changedAt: new Date().toISOString() });
    res.json({ ok: true, count: result.rowCount });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/read-all", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET read_at=now()
       WHERE parent_id=$1 AND read_at IS NULL AND deleted_at IS NULL`,
      [req.auth.parent_id]
    );
    await audit(req.auth.parent_id, null, "notifications_read_all", { count: result.rowCount });
    await publishEvent(pool, req.auth.parent_id, "notifications.read-all", { count: result.rowCount, changedAt: new Date().toISOString() });
    res.json({ ok: true, count: result.rowCount });
  } catch (err) { next(err); }
});

app.delete("/v1/notifications/:id", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = parseBigIntId(req.params.id);
    const result = await pool.query(
      `UPDATE notifications SET deleted_at=now()
       WHERE id=$1 AND parent_id=$2 AND deleted_at IS NULL RETURNING id`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Notification not found.", "notification_not_found");
    await audit(req.auth.parent_id, null, "notification_deleted", { notificationId: String(result.rows[0].id) });
    await publishEvent(pool, req.auth.parent_id, "notification.deleted", { id: String(result.rows[0].id), changedAt: new Date().toISOString() });
    res.json({ ok: true, id: String(result.rows[0].id) });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/bulk-delete", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const ids = parseNotificationIds(req.body);
    const result = await pool.query(
      `UPDATE notifications SET deleted_at=now()
       WHERE parent_id=$1 AND id=ANY($2::bigint[]) AND deleted_at IS NULL
       RETURNING id`,
      [req.auth.parent_id, ids]
    );
    await audit(req.auth.parent_id, null, "notifications_bulk_deleted", { requested: ids.length, deleted: result.rowCount });
    await publishEvent(pool, req.auth.parent_id, "notifications.bulk-deleted", { ids: result.rows.map(row => String(row.id)), count: result.rowCount, changedAt: new Date().toISOString() });
    res.json({ ok: true, count: result.rowCount });
  } catch (err) { next(err); }
});

app.get("/v1/devices", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const includeRevoked = String(req.query.includeRevoked || "0") === "1";
    const { rows } = await pool.query(
      `SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,last_sync_at,
              sync_failures,last_sync_error,pending_count,sync_dropped_count,created_at,updated_at,revoked_at
         FROM devices
        WHERE parent_id=$1 ${includeRevoked ? "" : "AND revoked_at IS NULL"}
        ORDER BY created_at DESC`,
      [req.auth.parent_id]
    );
    const activeCount = rows.filter(row => !row.revoked_at).length;
    res.json({
      devices: rows.map(serializeDevice),
      activeCount: includeRevoked ? activeCount : rows.length,
      revokedCount: includeRevoked ? rows.length - activeCount : 0,
      includeRevoked
    });
  } catch (err) { next(err); }
});

app.get("/v1/devices/:id", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,last_sync_at,
              sync_failures,last_sync_error,pending_count,sync_dropped_count,created_at,updated_at,revoked_at
         FROM devices WHERE id=$1 AND parent_id=$2`,
      [req.params.id, req.auth.parent_id]
    );
    if (!rows[0]) return sendError(res, req, 404, "Device not found.", "device_not_found");
    res.json({ device: serializeDevice(rows[0]) });
  } catch (err) { next(err); }
});

app.post("/v1/devices/pairing-codes", pairingLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const deviceLimit = await getDeviceLimit(req.auth.parent_id);
    const { rows: activeRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM devices WHERE parent_id=$1 AND revoked_at IS NULL",
      [req.auth.parent_id]
    );
    if (deviceLimit === 0) {
      return res.status(402).json({
        error: "Your trial has ended. Choose a paid plan to connect a child device.",
        code: "subscription_required",
        requestId: req.requestId
      });
    }
    if (activeRows[0].count >= deviceLimit) {
      return res.status(403).json({
        error: `Your current plan supports ${deviceLimit} child device${deviceLimit === 1 ? "" : "s"}.`,
        code: "device_limit_reached",
        requestId: req.requestId
      });
    }

    await pool.query(
      "UPDATE pairing_codes SET used_at=COALESCE(used_at,now()) WHERE parent_id=$1 AND used_at IS NULL AND expires_at>now()",
      [req.auth.parent_id]
    );

    const code = makePairingCode();
    const issuedAt = new Date();
    await pool.query(
      `INSERT INTO pairing_codes(id,parent_id,code_hash,expires_at) VALUES($1,$2,$3,$4)`,
      [crypto.randomUUID(), req.auth.parent_id, sha256(`${process.env.PAIRING_CODE_SECRET || "dev"}:${code}`), new Date(issuedAt.getTime() + 10 * 60 * 1000)]
    );
    await audit(req.auth.parent_id, null, "pairing_code_created", {});
    res.status(201).json({ code, expiresInSeconds: 600, issuedAt: issuedAt.toISOString() });
  } catch (err) { next(err); }
});

app.delete("/v1/devices/pairing-codes/:id", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE pairing_codes SET used_at=COALESCE(used_at,now())
       WHERE id=$1 AND parent_id=$2 AND used_at IS NULL AND expires_at>now()
       RETURNING id`,
      [req.params.id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Pairing code not found or already closed.", "pairing_code_not_found");
    await audit(req.auth.parent_id, null, "pairing_code_cancelled", { pairingCodeId: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.patch("/v1/devices/:id", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(80) }).strict().parse(req.body);
    const result = await pool.query(
      `UPDATE devices SET name=$1,updated_at=now()
         WHERE id=$2 AND parent_id=$3 AND revoked_at IS NULL
         RETURNING id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,last_sync_at,
                   sync_failures,last_sync_error,pending_count,sync_dropped_count,created_at,updated_at,revoked_at`,
      [input.name, req.params.id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Device not found.", "device_not_found");
    await audit(req.auth.parent_id, req.params.id, "device_updated", { changedFields: ["name"] });
    const device = serializeDevice(result.rows[0]);
    await publishEvent(pool, req.auth.parent_id, "device.updated", { device, changedAt: device.updated_at });
    res.json({ ok: true, device });
  } catch (err) { next(err); }
});

app.post("/v1/devices/:id/rename", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const name = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body).name;
    const result = await pool.query(
      `UPDATE devices SET name=$1,updated_at=now()
       WHERE id=$2 AND parent_id=$3 AND revoked_at IS NULL
       RETURNING id,name`,
      [name, req.params.id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Device not found.", "device_not_found");
    await audit(req.auth.parent_id, req.params.id, "device_renamed", { changedFields: ["name"] });
    await publishEvent(pool, req.auth.parent_id, "device.updated", { deviceId: req.params.id, name, changedAt: new Date().toISOString() });
    res.json({ ok: true, device: result.rows[0] });
  } catch (err) { next(err); }
});

app.get("/v1/device/status", deviceLimiter, requireDevice, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,last_sync_at,sync_failures,last_sync_error,pending_count,sync_dropped_count,created_at,revoked_at
         FROM devices WHERE id=$1`, [req.device.id]
    );
    const device = rows[0];
    if (!device || device.revoked_at) return sendError(res, req, 401, "Device is not authorized.", "device_not_authorized");
    res.json({ device: serializeDevice(device), serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

app.post("/v1/devices/:id/revoke", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `UPDATE devices SET revoked_at=now(), sharing_enabled=false, content_sharing_enabled=false
       WHERE id=$1 AND parent_id=$2 AND revoked_at IS NULL RETURNING id`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Device not found.", "device_not_found");
    await audit(req.auth.parent_id, id, "device_revoked", {});
    await publishEvent(pool, req.auth.parent_id, "device.revoked", { deviceId: id, changedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.delete("/v1/devices/:id", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE devices SET revoked_at=COALESCE(revoked_at,now()), sharing_enabled=false, content_sharing_enabled=false, updated_at=now()
       WHERE id=$1 AND parent_id=$2 AND revoked_at IS NULL RETURNING id`,
      [req.params.id, req.auth.parent_id]
    );
    if (!result.rowCount) return sendError(res, req, 404, "Device not found.", "device_not_found");
    await audit(req.auth.parent_id, req.params.id, "device_revoked", { method: "delete" });
    await publishEvent(pool, req.auth.parent_id, "device.revoked", { deviceId: req.params.id, changedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/v1/audit", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const input = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().max(512).optional(),
      action: z.string().trim().min(1).max(80).optional(),
      deviceId: z.string().uuid().optional()
    }).parse(req.query);
    let cursor = null;
    if (input.cursor) {
      try { cursor = decodeCursor(input.cursor); }
      catch { throw httpError(400, "Invalid audit pagination cursor.", "invalid_cursor"); }
    }
    const values = [req.auth.parent_id];
    const where = ["a.parent_id=$1"];
    if (input.action) {
      values.push(input.action);
      where.push(`a.action=$${values.length}`);
    }
    if (input.deviceId) {
      values.push(input.deviceId);
      where.push(`a.device_id=$${values.length}`);
    }
    if (cursor) {
      values.push(cursor.timestamp);
      const timeIndex = values.length;
      values.push(cursor.id);
      const idIndex = values.length;
      where.push(`(a.created_at < $${timeIndex}::timestamptz OR (a.created_at = $${timeIndex}::timestamptz AND a.id < $${idIndex}::bigint))`);
    }
    const limitIndex = values.length + 1;
    values.push(input.limit + 1);
    const { rows } = await pool.query(
      `SELECT a.id,a.device_id,a.actor_type,a.action,a.metadata,a.created_at,a.created_at::text AS created_at_cursor
         FROM audit_log a
        WHERE ${where.join(" AND ")}
        ORDER BY a.created_at DESC,a.id DESC
        LIMIT $${limitIndex}`,
      values
    );
    const hasMore = rows.length > input.limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore && rows.length
      ? encodeCursor({ timestamp: rows[rows.length - 1].created_at_cursor, id: rows[rows.length - 1].id })
      : null;
    res.json({
      items: rows.map(row => ({
        id: String(row.id),
        deviceId: row.device_id,
        actorType: row.actor_type,
        action: row.action,
        metadata: row.metadata || {},
        createdAt: row.created_at
      })),
      pageSize: rows.length,
      hasMore,
      nextCursor
    });
  } catch (err) { next(err); }
});

app.get("/v1/settings", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    const subscription = await getSubscription(req.auth.parent_id);
    res.json({ retentionDays: req.auth.retention_days, subscription });
  } catch (err) { next(err); }
});

app.patch("/v1/settings", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const retentionDays = z.object({ retentionDays: z.union([z.literal(7),z.literal(30),z.literal(60),z.literal(90)]) }).parse(req.body).retentionDays;
    const plan = (await getSubscription(req.auth.parent_id)).plan;
    if (retentionDays > plan.retention) throw httpError(403, `Your current plan includes up to ${plan.retention} days of notification retention.`);
    await pool.query("UPDATE parents SET retention_days=$1,updated_at=now() WHERE id=$2", [retentionDays, req.auth.parent_id]);
    await audit(req.auth.parent_id, null, "retention_changed", { retentionDays });
    res.json({ ok: true, retentionDays });
  } catch (err) { next(err); }
});

app.get("/v1/account/export", parentApiLimiter, requireParent, async (req, res, next) => {
  try {
    if (!hasRecentReauthentication(req.auth)) {
      return sendError(res, req, 401, "Recent reauthentication is required before exporting account data.", "reauthentication_required");
    }
    const parentId = req.auth.parent_id;
    const [parent, devices, notifications, subscription] = await Promise.all([
      pool.query("SELECT email,display_name,created_at,retention_days,terms_accepted_at,privacy_accepted_at FROM parents WHERE id=$1", [parentId]),
      pool.query("SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,created_at,revoked_at FROM devices WHERE parent_id=$1 ORDER BY created_at", [parentId]),
      pool.query("SELECT id,device_id,package_name,app_name,title_enc,body_enc,posted_at,received_at,read_at,deleted_at FROM notifications WHERE parent_id=$1 ORDER BY received_at DESC LIMIT 10000", [parentId]),
      getSubscription(parentId)
    ]);
    const rows = notifications.rows.map(row => ({
      id: row.id, deviceId: row.device_id, packageName: row.package_name, appName: row.app_name,
      title: decryptText(row.title_enc), body: decryptText(row.body_enc), postedAt: row.posted_at,
      receivedAt: row.received_at, readAt: row.read_at, deletedAt: row.deleted_at
    }));
    res.set("Cache-Control", "no-store");
    res.json({
      exportedAt: new Date().toISOString(),
      account: parent.rows[0] || null,
      devices: devices.rows,
      notifications: rows,
      subscription
    });
  } catch (err) { next(err); }
});

app.delete("/v1/account", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const parentId = req.auth.parent_id;
    const confirm = z.object({ confirmation: z.literal("DELETE"), password: z.string().min(1).max(128) }).parse(req.body);
    const { rows: accountRows } = await pool.query("SELECT password_hash FROM parents WHERE id=$1", [parentId]);
    if (!accountRows[0] || !passwordMatches(confirm.password, accountRows[0].password_hash)) {
      return sendError(res, req, 401, "The current password is incorrect.", "reauthentication_failed");
    }
    if (!hasRecentReauthentication(req.auth)) {
      await reauthenticate(pool, req.auth.id, confirm.password, accountRows[0].password_hash);
    }
    if (confirm.confirmation !== "DELETE") throw httpError(400, "Type DELETE to confirm account deletion.");
    await tx(async client => {
      await client.query("DELETE FROM audit_log WHERE parent_id=$1", [parentId]);
      await client.query("DELETE FROM webhook_events WHERE parent_id=$1", [parentId]);
      await client.query("DELETE FROM parents WHERE id=$1", [parentId]);
    });
    clearSessionCookies(res);
    res.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    res.set("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/v1/billing/plans", (_req, res) => {
  res.json({
    plans: Object.values(PLANS).filter(p => p.key !== "trial").map(({ key,name,devices,retention,displayPrice }) => ({
      key,name,devices,retention,displayPrice
    }))
  });
});

app.get("/v1/billing/status", requireParent, async (req, res, next) => {
  try { res.json({ subscription: await getSubscription(req.auth.parent_id) }); }
  catch (err) { next(err); }
});

app.post("/v1/billing/subscription", parentApiLimiter, requireParent, requireCsrf, async (req, res, next) => {
  let client = null;
  let lockAcquired = false;
  try {
    const input = z.object({ planKey: z.enum(["weekly","monthly"]), password: z.string().min(1).max(128) }).parse(req.body);
    const planKey = input.planKey;
    if (!hasRecentReauthentication(req.auth)) {
      const { rows: accountRows } = await pool.query("SELECT password_hash FROM parents WHERE id=$1", [req.auth.parent_id]);
      if (!accountRows[0] || !passwordMatches(input.password, accountRows[0].password_hash)) {
        return sendError(res, req, 401, "Current password required for billing changes.", "reauthentication_required");
      }
      await reauthenticate(pool, req.auth.id, input.password, accountRows[0].password_hash);
    }
    const plan = planFor(planKey);
    const planId = planKey === "weekly" ? process.env.RAZORPAY_PLAN_WEEKLY : (process.env.RAZORPAY_PLAN_MONTHLY || process.env.RAZORPAY_PLAN_STARTER);
    if (!planId) return sendError(res, req, 503, "Billing is being configured. Please try again later.", "billing_unavailable");

    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [req.auth.parent_id]);
    lockAcquired = true;
    const current = await client.query(
      `SELECT provider_subscription_id,status,plan_key
         FROM subscriptions WHERE parent_id=$1`,
      [req.auth.parent_id]
    );
    const existing = current.rows[0];
    if (existing?.provider_subscription_id && ["created","pending","authenticated","active"].includes(String(existing.status).toLowerCase())) {
      return res.status(409).json({
        error: "A subscription is already in progress or active. Manage the existing subscription instead of creating another one.",
        code: "subscription_already_exists",
        requestId: req.requestId
      });
    }

    const subscription = await createRazorpaySubscription({
      planId,
      totalCount: subscriptionTotalCountFor(planKey)
    });
    const updated = await client.query(
      `UPDATE subscriptions
          SET plan_key=$1,provider='razorpay',provider_subscription_id=$2,status='created',updated_at=now()
        WHERE parent_id=$3
        RETURNING plan_key,status,provider_subscription_id`,
      [plan.key, subscription.id, req.auth.parent_id]
    );
    if (!updated.rowCount) throw httpError(500, "Subscription record is not available.", "billing_state_error");
    await audit(req.auth.parent_id, null, "subscription_created", { planKey });
    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId: subscription.id,
      plan: { key: plan.key, name: plan.name, displayPrice: plan.displayPrice }
    });
  } catch (err) { next(err); }
  finally {
    if (client) {
      if (lockAcquired) {
        try { await client.query("SELECT pg_advisory_unlock(hashtext($1))", [req.auth?.parent_id]); } catch {}
      }
      client.release();
    }
  }
});

app.get("/v1/events/stream", eventStreamLimiter, requireParent, async (req, res, next) => {
  try {
    const rawLastId = String(req.header("last-event-id") || req.query.since || "").trim();
    if (rawLastId) {
      if (!/^\d+$/.test(rawLastId) || rawLastId.length > REALTIME_MAX_SINCE_ID_DIGITS || BigInt(rawLastId) > MAX_POSTGRES_BIGINT) {
        return sendError(res, req, 400, "Invalid realtime cursor.", "invalid_realtime_cursor");
      }
    }

    if (clientCount(req.auth.parent_id) >= 5) {
      res.setHeader("Retry-After", "30");
      return sendError(res, req, 429, "Too many realtime connections for this account. Close an older dashboard tab and try again.", "realtime_connection_limit");
    }

    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();

    const registration = addClient(req.auth.parent_id, res, { buffering: true });
    const cleanup = registration.cleanup;

    try {
      const snapshotResult = rawLastId
        ? await pool.query("SELECT MAX(id) AS max_id FROM realtime_events WHERE parent_id=$1", [req.auth.parent_id])
        : { rows: [{ max_id: null }] };
      const snapshotMaxId = snapshotResult.rows[0]?.max_id == null ? null : String(snapshotResult.rows[0].max_id);
      streamReady(res);
      if (rawLastId) await replayEvents(pool, req.auth.parent_id, rawLastId, res, snapshotMaxId);
      finishReplay(registration.client, rawLastId ? snapshotMaxId : null);
    } catch (err) {
      registration.client.buffer.length = 0;
      registration.client.buffering = false;
      cleanup();
      throw err;
    }

    const keepAlive = setInterval(() => {
      if (res.writableEnded || res.destroyed) return cleanup();
      try { res.write(`: keep-alive ${Date.now()}\n\n`); } catch { cleanup(); }
    }, 20_000);
    const sessionWatch = setInterval(async () => {
      if (res.writableEnded || res.destroyed) return cleanup();
      try {
        const active = await refreshSessionActivity(pool, req.auth.id);
        if (!active) {
          try { res.write(formatSessionCloseEvent()); } catch {}
          try { res.end(); } catch {}
          cleanup();
        }
      } catch (err) {
        logger.warn({ err, sessionId: req.auth.id }, "realtime_session_check_failed");
      }
    }, 60_000);
    res.on("close", () => { clearInterval(keepAlive); clearInterval(sessionWatch); cleanup(); });
    res.setTimeout?.(0);
  } catch (err) { next(err); }
});

app.post("/v1/device/pair", pairingLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      code: z.string().trim().toUpperCase().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/),
      name: z.string().trim().min(1).max(80),
      appVersion: z.string().trim().max(40).optional()
    }).parse(req.body);

    if (process.env.NODE_ENV === "production" && !process.env.PAIRING_CODE_SECRET) {
      throw httpError(503, "Pairing is temporarily unavailable.");
    }

    const codeHash = sha256(`${process.env.PAIRING_CODE_SECRET || "development-only"}:${input.code}`);
    const result = await tx(async client => {
      const pair = await client.query(
        `SELECT id,parent_id FROM pairing_codes
          WHERE code_hash=$1 AND used_at IS NULL AND expires_at>now()
          FOR UPDATE`,
        [codeHash]
      );
      if (!pair.rowCount) throw httpError(400, "That pairing code is invalid or expired.");

      const parentId = pair.rows[0].parent_id;
      const { rows: sub } = await client.query(
        "SELECT plan_key,trial_ends_at,current_period_end,status FROM subscriptions WHERE parent_id=$1",
        [parentId]
      );
      const access = subscriptionAccess(sub[0]);
      if (!access.entitled) throw httpError(402, "Your trial has ended. Choose a paid plan to connect a child device.", "subscription_required");
      const plan = access.plan;
      const count = await client.query(
        "SELECT COUNT(*)::int AS count FROM devices WHERE parent_id=$1 AND revoked_at IS NULL",
        [parentId]
      );
      if (count.rows[0].count >= plan.devices) throw httpError(403, "Your plan has reached its device limit.", "device_limit_reached");

      const deviceId = crypto.randomUUID();
      const token = randomToken(32);
      await client.query(
        `INSERT INTO devices(id,parent_id,name,device_token_hash,app_version)
         VALUES($1,$2,$3,$4,$5)`,
        [deviceId,parentId,input.name,sha256(token),input.appVersion || null]
      );
      await client.query("UPDATE pairing_codes SET used_at=now() WHERE id=$1", [pair.rows[0].id]);
      await client.query(
        `INSERT INTO audit_log(parent_id,device_id,actor_type,action,metadata) VALUES($1,$2,'device','device_paired',$3)`,
        [parentId,deviceId,JSON.stringify({ name: input.name })]
      );
      return { deviceId, token, parentId, deviceName: input.name, appVersion: input.appVersion || null };
    });

    await publishEvent(pool, result.parentId, "device.paired", {
      deviceId: result.deviceId,
      deviceName: result.deviceName,
      platform: "android",
      appVersion: result.appVersion || null,
      pairedAt: new Date().toISOString()
    });

    res.status(201).json({
      deviceId: result.deviceId,
      deviceToken: result.token,
      serverTime: new Date().toISOString()
    });
  } catch (err) { next(err); }
});

app.post("/v1/device/unpair", deviceLimiter, requireDevice, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE devices SET revoked_at=now(),sharing_enabled=false,content_sharing_enabled=false WHERE id=$1`,
      [req.device.id]
    );
    await audit(req.device.parent_id, req.device.id, "device_unpaired_by_device", {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/v1/device/heartbeat", deviceLimiter, requireDevice, async (req, res, next) => {
  try {
    const input = z.object({
      appVersion: z.string().trim().max(40).optional(),
      sharingEnabled: z.boolean().optional(),
      contentSharingEnabled: z.boolean().optional(),
      pendingCount: z.number().int().min(0).max(10000).optional(),
      syncFailures: z.number().int().min(0).max(20).optional(),
      syncError: z.string().trim().max(240).optional().nullable(),
      syncDroppedCount: z.number().int().min(0).max(1000000000).optional()
    }).parse(req.body);

    const result = await pool.query(
      `UPDATE devices SET last_seen_at=now(),last_sync_at=now(),app_version=COALESCE($1,app_version),
          sharing_enabled=COALESCE($2,sharing_enabled),
          content_sharing_enabled=COALESCE($3,content_sharing_enabled),
          pending_count=COALESCE($4,pending_count),
          sync_failures=COALESCE($5,sync_failures),
          last_sync_error=NULLIF($6::text,''),
          sync_dropped_count=COALESCE($7,sync_dropped_count),
          updated_at=now()
       WHERE id=$8 AND revoked_at IS NULL
       RETURNING id,name,sharing_enabled,content_sharing_enabled,last_seen_at,last_sync_at,sync_failures,last_sync_error,pending_count,sync_dropped_count`,
      [input.appVersion || null, input.sharingEnabled, input.contentSharingEnabled, input.pendingCount, input.syncFailures, input.syncError, input.syncDroppedCount, req.device.id]
    );
    if (!result.rowCount) return sendError(res, req, 401, "Device is not authorized.", "device_not_authorized");
    const nextDevice = result.rows[0];
    const syncChanged = [
      "sharing_enabled", "content_sharing_enabled", "pending_count",
      "sync_failures", "last_sync_error", "sync_dropped_count"
    ].some(key => String(nextDevice[key] ?? "") !== String(req.device[key] ?? ""));
    if (syncChanged) {
      await publishEvent(pool, req.device.parent_id, "device.sync.updated", {
        deviceId: nextDevice.id,
        name: nextDevice.name,
        sharingEnabled: nextDevice.sharing_enabled,
        contentSharingEnabled: nextDevice.content_sharing_enabled,
        pendingCount: nextDevice.pending_count,
        syncFailures: nextDevice.sync_failures,
        lastSyncError: nextDevice.last_sync_error,
        syncDroppedCount: nextDevice.sync_dropped_count,
        lastSyncAt: nextDevice.last_sync_at,
        lastSeenAt: nextDevice.last_seen_at,
        changedAt: nextDevice.last_sync_at
      });
    }
    res.json({ ok: true, device: nextDevice, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

app.post("/v1/device/notifications", deviceLimiter, requireDevice, requireDeviceEntitlement, async (req, res, next) => {
  try {
    const parsed = z.object({
      notifications: z.array(z.object({
        clientNotificationId: z.string().min(1).max(180),
        notificationKeyHash: z.string().regex(/^[a-f0-9]{64}$/i),
        packageName: z.string().min(1).max(200),
        appName: z.string().min(1).max(120),
        notificationType: z.enum(["message","email","call","media","alarm","reminder","event","system","progress","service","other"]),
        category: z.string().max(40).optional().nullable(),
        channelId: z.string().max(200).optional().nullable(),
        groupKey: z.string().max(300).optional().nullable(),
        isOngoing: z.boolean().default(false),
        isClearable: z.boolean().default(false),
        isGroupSummary: z.boolean().default(false),
        contentState: z.enum(["available","withheld","unavailable"]),
        title: z.string().max(500).optional().nullable(),
        body: z.string().max(5000).optional().nullable(),
        postedAt: z.string().datetime()
      })).min(1).max(50)
    }).parse(req.body);

    const inserted = [];
    let parentId = null;
    let deviceName = null;
    let rejection = null;

    await tx(async client => {
      // Lock the current device row so a parent revoke/share-off cannot race a notification
      // upload that started with an older requireDevice snapshot.
      const { rows } = await client.query(
        `SELECT id,parent_id,name,sharing_enabled,content_sharing_enabled,revoked_at
           FROM devices WHERE id=$1 FOR UPDATE`,
        [req.device.id]
      );
      const device = rows[0];
      if (!device || device.revoked_at) {
        rejection = { status: 401, message: "Device is not authorized.", code: "device_not_authorized" };
        return;
      }
      if (!device.sharing_enabled) {
        rejection = { status: 409, message: "Notification sharing is disabled for this device.", code: "sharing_disabled" };
        return;
      }

      parentId = device.parent_id;
      deviceName = device.name;
      for (const n of parsed.notifications) {
        if (!device.content_sharing_enabled) {
          n.title = null;
          n.body = null;
          n.contentState = "withheld";
        } else if (!n.title && !n.body) {
          n.contentState = "unavailable";
        } else {
          n.contentState = "available";
        }

        const result = await client.query(
          `INSERT INTO notifications(
            device_id,parent_id,client_notification_id,notification_key_hash,package_name,app_name,
            notification_type,category,channel_id,group_key,is_ongoing,is_clearable,is_group_summary,content_state,
            title_enc,body_enc,posted_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT(device_id,client_notification_id) DO NOTHING
           RETURNING id,package_name,app_name,notification_type,content_state,posted_at,received_at,read_at`,
          [
            device.id, device.parent_id, n.clientNotificationId, n.notificationKeyHash, n.packageName, n.appName,
            n.notificationType, n.category, n.channelId, n.groupKey,
            n.isOngoing, n.isClearable, n.isGroupSummary, n.contentState,
            encryptText(n.title), encryptText(n.body), n.postedAt
          ]
        );
        if (result.rowCount) inserted.push(result.rows[0]);
      }

      await client.query(
        `UPDATE devices SET last_seen_at=now(),last_sync_at=now(),sync_failures=0,last_sync_error=NULL,updated_at=now()
         WHERE id=$1`,
        [device.id]
      );
    });

    if (rejection) return sendError(res, req, rejection.status, rejection.message, rejection.code || "device_request_rejected");

    for (const n of inserted) {
      await publishEvent(pool, parentId, "notification", {
        id: String(n.id),
        appName: n.app_name,
        packageName: n.package_name,
        notificationType: n.notification_type,
        contentState: n.content_state,
        postedAt: n.posted_at,
        receivedAt: n.received_at,
        deviceId: req.device.id,
        deviceName,
        title: null,
        body: null
      });
    }

    res.status(201).json({
      accepted: inserted.length,
      duplicateOrIgnored: parsed.notifications.length - inserted.length,
      serverTime: new Date().toISOString()
    });
  } catch (err) { next(err); }
});

async function handleBillingWebhook(req, res) {
  try {
    const signature = req.header("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send("Billing webhook is not configured");
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const expected = hmacSha256(raw, secret);
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(signature, "utf8");
    if (!signature || expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return res.status(401).send("invalid signature");
    }

    const payload = JSON.parse(raw.toString("utf8"));
    const eventType = String(payload.event || "unknown");
    const eventId = String(req.header("x-razorpay-event-id") || crypto.createHash("sha256").update(raw).digest("hex"));

    const entity = payload?.payload?.subscription?.entity || payload?.payload?.payment?.entity || null;
    const providerSubscriptionId = entity?.id || entity?.subscription_id || null;
    let webhookParentId = null;
    if (providerSubscriptionId) {
      const { rows } = await pool.query(
        "SELECT parent_id FROM subscriptions WHERE provider_subscription_id=$1",
        [providerSubscriptionId]
      );
      webhookParentId = rows[0]?.parent_id || null;
    }

    // Keep only the minimum metadata required for idempotency/diagnostics.
    // Do not persist the complete payment-provider payload, which may contain
    // customer/payment fields unrelated to KidRaksha operation.
    const eventRecord = JSON.stringify({ providerSubscriptionId });
    const inserted = await pool.query(
      `INSERT INTO webhook_events(provider,provider_event_id,event_type,parent_id,payload)
       VALUES('razorpay',$1,$2,$3,$4)
       ON CONFLICT(provider,provider_event_id) DO NOTHING`,
      [eventId,eventType,webhookParentId,eventRecord]
    );
    if (!inserted.rowCount) return res.json({ ok: true, duplicate: true });
    if (providerSubscriptionId) {
      const status = normalizeSubscriptionStatus(eventType, entity?.status);
      const providerPlan = planFromProviderId(entity?.plan_id);
      const { rows: currentSub } = await pool.query(
        "SELECT plan_key FROM subscriptions WHERE provider_subscription_id=$1",
        [providerSubscriptionId]
      );
      const plan = providerPlan || planFor(currentSub[0]?.plan_key || "trial");
      const periodStart = entity?.current_start ? new Date(entity.current_start * 1000) : null;
      const periodEnd = entity?.current_end ? new Date(entity.current_end * 1000) : null;
      await pool.query(
        `UPDATE subscriptions
            SET plan_key=$1,status=$2,current_period_start=COALESCE($3,current_period_start),
                current_period_end=COALESCE($4,current_period_end),updated_at=now()
          WHERE provider_subscription_id=$5`,
        [plan.key,status,periodStart,periodEnd,providerSubscriptionId]
      );
      const { rows: affected } = await pool.query("SELECT parent_id FROM subscriptions WHERE provider_subscription_id=$1", [providerSubscriptionId]);
      if (affected[0]) {
        await audit(affected[0].parent_id, null, "billing_webhook_applied", { eventType, status }, "system");
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(400).send("invalid webhook");
  }
}

function serializeDevice(row) {
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const online = lastSeen > 0 && Date.now() - lastSeen < DEVICE_ONLINE_WINDOW_MS && !row.revoked_at;
  const pending = Number(row.pending_count || 0);
  const failures = Number(row.sync_failures || 0);
  const syncStatus = failures > 0 ? "error" : pending > 0 ? "pending" : online ? "healthy" : "stale";
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    app_version: row.app_version,
    sharing_enabled: row.sharing_enabled,
    content_sharing_enabled: row.content_sharing_enabled,
    status: row.revoked_at ? "revoked" : online ? "online" : "offline",
    sync_status: syncStatus,
    last_seen_at: row.last_seen_at,
    last_sync_at: row.last_sync_at,
    sync_failures: failures,
    last_sync_error: row.last_sync_error,
    pending_count: pending,
    sync_dropped_count: String(row.sync_dropped_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    revoked_at: row.revoked_at
  };
}

function parseBigIntId(value) {
  const raw = String(value ?? "");
  try {
    const numeric = BigInt(raw);
    if (!/^\d{1,19}$/.test(raw) || numeric <= 0n || numeric > 9223372036854775807n) throw new Error();
  } catch {
    throw httpError(400, "Invalid notification id.", "invalid_notification_id");
  }
  return raw;
}

function parseNotificationIds(body) {
  const schema = z.object({
    ids: z.array(z.union([
      z.string().regex(/^\d{1,19}$/),
      z.number().int().safe().positive()
    ])).min(1).max(100)
  });
  const ids = schema.parse(body).ids.map(String);
  for (const id of ids) parseBigIntId(id);
  return [...new Set(ids)];
}

function parseNotificationListQuery(query) {
  const notificationTypes = ["message","email","call","media","alarm","reminder","event","system","progress","service","other"];
  const input = z.object({
    search: z.string().trim().max(120).optional(),
    unread: z.enum(["0","1"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).optional(),
    cursor: z.string().max(512).optional(),
    deviceId: z.string().uuid().optional(),
    type: z.enum(notificationTypes).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  }).parse(query);
  if (input.from && input.to && new Date(input.from) >= new Date(input.to)) {
    throw httpError(400, "The 'from' time must be earlier than the 'to' time.", "invalid_notification_range");
  }
  let cursor = null;
  if (input.cursor) {
    try { cursor = decodeNotificationCursor(input.cursor); }
    catch { throw httpError(400, "Invalid pagination cursor.", "invalid_cursor"); }
  }
  if (cursor && input.offset !== undefined) {
    throw httpError(400, "Use either cursor or offset pagination, not both.", "mixed_pagination");
  }
  return {
    search: input.search || "",
    unreadOnly: input.unread === "1",
    limit: input.limit,
    offset: input.offset,
    cursor,
    cursorRaw: input.cursor || null,
    deviceId: input.deviceId || null,
    type: input.type || null,
    from: input.from || null,
    to: input.to || null
  };
}

function serializeNotification(row) {
  return {
    id: String(row.id),
    package_name: row.package_name,
    app_name: row.app_name,
    notification_type: row.notification_type,
    category: row.category,
    channel_id: row.channel_id,
    group_key: row.group_key,
    is_ongoing: row.is_ongoing,
    is_clearable: row.is_clearable,
    is_group_summary: row.is_group_summary,
    content_state: row.content_state,
    title: decryptText(row.title_enc),
    body: decryptText(row.body_enc),
    posted_at: row.posted_at,
    received_at: row.received_at,
    read_at: row.read_at,
    device_id: row.device_id,
    device_name: row.device_name
  };
}

async function getNotifications(parentId, {
  search = "",
  unreadOnly = false,
  limit = 50,
  offset,
  cursor = null,
  deviceId = null,
  type = null,
  from = null,
  to = null
} = {}) {
  const values = [parentId];
  const where = ["n.parent_id=$1", "n.deleted_at IS NULL"];
  if (unreadOnly) where.push("n.read_at IS NULL");
  if (deviceId) {
    values.push(deviceId);
    where.push(`n.device_id=$${values.length}`);
  }
  if (type) {
    values.push(type);
    where.push(`n.notification_type=$${values.length}`);
  }
  if (from) {
    values.push(new Date(from));
    where.push(`n.received_at >= $${values.length}`);
  }
  if (to) {
    values.push(new Date(to));
    where.push(`n.received_at < $${values.length}`);
  }
  if (search) {
    const escaped = search.replace(/[%_\\]/g, "\\$&");
    values.push(`%${escaped}%`);
    const idx = values.length;
    where.push(`(
      n.app_name ILIKE $${idx} ESCAPE '\\'
      OR n.package_name ILIKE $${idx} ESCAPE '\\'
      OR d.name ILIKE $${idx} ESCAPE '\\'
      OR n.notification_type ILIKE $${idx} ESCAPE '\\'
      OR COALESCE(n.category,'') ILIKE $${idx} ESCAPE '\\'
    )`);
  }
  if (cursor) {
    values.push(cursor.receivedAt);
    const timeIndex = values.length;
    values.push(cursor.id);
    const idIndex = values.length;
    where.push(`(n.received_at < $${timeIndex}::timestamptz OR (n.received_at = $${timeIndex}::timestamptz AND n.id < $${idIndex}::bigint))`);
  }

  const limitIndex = values.length + 1;
  values.push(limit + 1);
  let offsetClause = "";
  if (offset !== undefined && offset !== null) {
    const offsetIndex = values.length + 1;
    values.push(offset);
    offsetClause = ` OFFSET $${offsetIndex}`;
  }

  const { rows } = await pool.query(
    `SELECT n.id,n.package_name,n.app_name,n.notification_type,n.category,n.channel_id,n.group_key,
            n.is_ongoing,n.is_clearable,n.is_group_summary,n.content_state,n.title_enc,n.body_enc,
            n.posted_at,n.received_at,n.received_at::text AS received_at_cursor,n.read_at,
            d.id AS device_id,d.name AS device_name
       FROM notifications n
       JOIN devices d ON d.id=n.device_id
      WHERE ${where.join(" AND ")}
      ORDER BY n.received_at DESC,n.id DESC
      LIMIT $${limitIndex}${offsetClause}`,
    values
  );

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const items = rows.map(serializeNotification);
  const nextCursor = hasMore && rows.length ? notificationCursorFromRow(rows[rows.length - 1]) : null;

  return {
    items,
    pageSize: items.length,
    hasMore,
    nextCursor,
    pagination: {
      type: cursor || offset === undefined ? "cursor" : "offset",
      cursor: nextCursor,
      offset: offset === undefined ? null : offset,
      maxPageSize: 100,
      maxOffset: 5000
    },
    searchScope: ["app_name", "package_name", "device_name", "notification_type", "category"]
  };
}

async function getSubscription(parentId) {
  const { rows } = await pool.query(
    `SELECT plan_key,status,trial_ends_at,current_period_start,current_period_end,provider_subscription_id
       FROM subscriptions WHERE parent_id=$1`, [parentId]
  );
  const sub = rows[0];
  const access = subscriptionAccess(sub);
  return {
    plan: access.plan,
    requestedPlan: planFor(sub?.plan_key || "trial"),
    status: sub?.status || "trialing",
    access: access.state,
    entitled: access.entitled,
    trialEndsAt: sub?.trial_ends_at || null,
    currentPeriodStart: sub?.current_period_start || null,
    currentPeriodEnd: sub?.current_period_end || null,
    providerSubscriptionId: sub?.provider_subscription_id || null,
    limits: access.entitled ? { devices: access.plan.devices, retentionDays: access.plan.retention } : { devices: 0, retentionDays: 0 }
  };
}

async function getDeviceLimit(parentId) {
  const subscription = await getSubscription(parentId);
  return subscription.entitled ? subscription.plan.devices : 0;
}

function normalizeSubscriptionStatus(eventType, providerStatus) {
  if (["subscription.charged","subscription.activated","subscription.resumed"].includes(eventType)) return "active";
  if (["subscription.cancelled","subscription.completed"].includes(eventType)) return "cancelled";
  if (providerStatus) return String(providerStatus);
  return "pending";
}

function makePairingCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function httpError(status, message, code = "request_error") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function sendError(res, req, status, message, code = "request_error", extra = {}) {
  return res.status(status).json({ error: message, code, requestId: req.requestId, ...extra });
}

async function audit(parentId, deviceId, action, metadata, actorType = deviceId ? "device" : "parent") {
  await pool.query(
    `INSERT INTO audit_log(parent_id,device_id,actor_type,action,metadata)
     VALUES($1,$2,$3,$4,$5)`,
    [parentId, deviceId, actorType, action, JSON.stringify(metadata || {})]
  );
}

function setSessionCookies(res, session) {
  res.cookie(COOKIE_NAME, session.token, { ...cookieOptions(), maxAge: 14 * 24 * 60 * 60 * 1000 });
  res.cookie(CSRF_COOKIE, session.csrf, { ...publicCsrfCookieOptions(), maxAge: 14 * 24 * 60 * 60 * 1000 });
}

function clearSessionCookies(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.clearCookie(CSRF_COOKIE, publicCsrfCookieOptions());
}

function formatSessionCloseEvent() {
  return 'event: session.revoked\ndata: {"reason":"session_invalid"}\n\n';
}

async function requireParent(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const session = await getSession(pool, token);
    if (!session) return sendError(res, req, 401, "Authentication required.", "authentication_required");
    req.auth = session;
    next();
  } catch (err) { next(err); }
}

async function requireCsrf(req, res, next) {
  try {
    const fetchSite = req.header("sec-fetch-site");
    if (fetchSite === "cross-site") {
      return sendError(res, req, 403, "Cross-site state-changing requests are not allowed.", "cross_site_request_rejected");
    }
    const origin = req.header("origin");
    if (origin && origin !== process.env.PUBLIC_WEB_ORIGIN) {
      return sendError(res, req, 403, "Request origin is not allowed.", "origin_rejected");
    }
    if (process.env.NODE_ENV === "production" && origin !== process.env.PUBLIC_WEB_ORIGIN) {
      return sendError(res, req, 403, "Request origin is required.", "origin_required");
    }
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.header("x-csrf-token");
    if (!cookieToken || !headerToken) return sendError(res, req, 403, "CSRF validation failed.", "csrf_failed");
    const supplied = sha256(headerToken);
    const cookieHash = sha256(cookieToken);
    if (!timingSafeEqualHex(supplied, cookieHash)) return sendError(res, req, 403, "CSRF validation failed.", "csrf_failed");
    const session = req.auth;
    if (!session?.id) return sendError(res, req, 401, "Authentication required.", "authentication_required");
    if (!session.csrf_token_hash || !timingSafeEqualHex(supplied, session.csrf_token_hash)) {
      return sendError(res, req, 403, "CSRF validation failed.", "csrf_failed");
    }
    next();
  } catch (err) { next(err); }
}

async function requireDevice(req, res, next) {
  try {
    const header = req.header("authorization") || "";
    if (!header.startsWith("Bearer ")) return sendError(res, req, 401, "Device authentication required.", "device_authentication_required");
    const tokenHash = sha256(header.slice(7));
    const { rows } = await pool.query(
      `SELECT id,parent_id,name,sharing_enabled,content_sharing_enabled,revoked_at
         FROM devices WHERE device_token_hash=$1`, [tokenHash]
    );
    if (!rows[0] || rows[0].revoked_at) return sendError(res, req, 401, "Device is not authorized.", "device_not_authorized");
    req.device = rows[0];
    next();
  } catch (err) { next(err); }
}

async function requireDeviceEntitlement(req, res, next) {
  try {
    const subscription = await getSubscription(req.device.parent_id);
    if (!subscription.entitled) {
      return res.status(402).json({
        error: "The parent subscription is not active. Notification synchronization is paused.",
        code: "subscription_required",
        requestId: req.requestId
      });
    }
    req.deviceEntitlement = subscription;
    next();
  } catch (err) { next(err); }
}

app.use((err, req, res, _next) => {
  const requestId = req.requestId || crypto.randomUUID();
  if (err instanceof z.ZodError) {
    logger.warn({ requestId, issues: err.issues.map(issue => ({ path: issue.path, code: issue.code })) }, "request_validation_failed");
    return sendError(res, req, 400, "Invalid request.", "invalid_request", {
      issues: err.issues.map(issue => ({ path: issue.path, code: issue.code }))
    });
  }
  logger.error({ err, requestId, statusCode: err.status || 500 }, "request_failed");
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? (err.status ? err.message : "Something went wrong.") : err.message,
    code: err.code || "internal_error",
    requestId
  });
});

await waitForRateLimiter();
const server = app.listen(port, () => logger.info({ port, apiVersion: API_VERSION, contractVersion: API_CONTRACT_VERSION }, "api_listening"));
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 65_000;

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "api_shutdown");
  const forceTimer = setTimeout(() => {
    logger.error("api_shutdown_timeout");
    process.exit(1);
  }, 15_000);
  forceTimer.unref();
  server.close(async () => {
    try { await closeRateLimiter(); } catch (err) { logger.warn({ err }, "rate_limiter_close_failed"); }
    try { await pool.end(); } catch (err) { logger.warn({ err }, "db_pool_close_failed"); }
    clearTimeout(forceTimer);
    process.exit(0);
  });
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught_exception");
  void shutdown("uncaughtException");
});
process.once("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandled_rejection");
  void shutdown("unhandledRejection");
});
