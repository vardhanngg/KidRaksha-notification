
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { z } from "zod";
import { pool, tx } from "./db.js";
import { createSession, getSession, deleteSession, cookieOptions, publicCsrfCookieOptions, COOKIE_NAME, CSRF_COOKIE, passwordHash, passwordMatches } from "./auth.js";
import { randomToken, sha256, encryptText, decryptText } from "./crypto.js";
import { addClient, broadcast } from "./events.js";
import { PLANS, planFor, planFromProviderId, hmacSha256, createRazorpaySubscription } from "./billing.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const allowedOrigin = process.env.PUBLIC_WEB_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.post("/v1/billing/webhook", express.raw({ type: "application/json", limit: "256kb" }), handleBillingWebhook);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/v1/")) res.setHeader("Cache-Control", "no-store");
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const pairingLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const deviceLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "DATA_ENCRYPTION_KEY", "PAIRING_CODE_SECRET", "RAZORPAY_WEBHOOK_SECRET", "PUBLIC_WEB_ORIGIN"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
}

validateRuntimeConfig();

async function healthHandler(_req, res) {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "kidraksha-api", time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false });
  }
}
app.get("/health", healthHandler);
app.get("/v1/health", healthHandler);

app.post("/v1/auth/signup", authLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(200).transform(v => v.trim().toLowerCase()),
      password: z.string().min(10).max(128),
      displayName: z.string().trim().min(1).max(80),
      acceptedPolicies: z.literal(true)
    }).parse(req.body);

    const exists = await pool.query("SELECT 1 FROM parents WHERE email=$1", [input.email]);
    if (exists.rowCount) return res.status(409).json({ error: "An account with that email already exists." });

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
        [id, JSON.stringify({ email: input.email, policiesAccepted: true })]
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
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const session = await createSession(pool, parent.id);
    await audit(parent.id, null, "login", {});
    setSessionCookies(res, session);
    res.json({ user: { id: parent.id, email: parent.email, displayName: parent.display_name } });
  } catch (err) { next(err); }
});

app.post("/v1/auth/logout", requireParent, requireCsrf, async (req, res, next) => {
  try {
    await audit(req.auth.parent_id, null, "logout", {});
    await deleteSession(pool, req.cookies?.[COOKIE_NAME] || req.header("x-session-token"));
    clearSessionCookies(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
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

app.get("/v1/notifications", requireParent, async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 120);
    const unreadOnly = String(req.query.unread || "") === "1";
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const result = await getNotifications(req.auth.parent_id, { search, unreadOnly, limit, offset });
    res.json(result);
  } catch (err) { next(err); }
});

app.post("/v1/notifications/:id/read", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "Invalid notification id." });
    const result = await pool.query(
      `UPDATE notifications SET read_at=COALESCE(read_at,now())
       WHERE id=$1 AND parent_id=$2 AND deleted_at IS NULL RETURNING id,read_at`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Notification not found." });
    res.json({ ok: true, ...result.rows[0] });
  } catch (err) { next(err); }
});

app.post("/v1/notifications/read-all", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET read_at=now()
       WHERE parent_id=$1 AND read_at IS NULL AND deleted_at IS NULL`,
      [req.auth.parent_id]
    );
    await audit(req.auth.parent_id, null, "notifications_read_all", { count: result.rowCount });
    res.json({ ok: true, count: result.rowCount });
  } catch (err) { next(err); }
});

app.delete("/v1/notifications/:id", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(
      `UPDATE notifications SET deleted_at=now()
       WHERE id=$1 AND parent_id=$2 AND deleted_at IS NULL RETURNING id`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Notification not found." });
    await audit(req.auth.parent_id, null, "notification_deleted", { notificationId: id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/v1/devices", requireParent, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,created_at,updated_at
         FROM devices WHERE parent_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [req.auth.parent_id]
    );
    res.json({ devices: rows });
  } catch (err) { next(err); }
});

app.post("/v1/devices/pairing-codes", pairingLimiter, requireParent, requireCsrf, async (req, res, next) => {
  try {
    const deviceLimit = await getDeviceLimit(req.auth.parent_id);
    const { rows: activeRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM devices WHERE parent_id=$1 AND revoked_at IS NULL",
      [req.auth.parent_id]
    );
    if (activeRows[0].count >= deviceLimit) {
      return res.status(403).json({ error: `Your current plan supports ${deviceLimit} child device${deviceLimit === 1 ? "" : "s"}.` });
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
    if (!result.rowCount) return res.status(404).json({ error: "Pairing code not found or already closed." });
    await audit(req.auth.parent_id, null, "pairing_code_cancelled", { pairingCodeId: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/v1/devices/:id/rename", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const name = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body).name;
    const result = await pool.query(
      `UPDATE devices SET name=$1,updated_at=now()
       WHERE id=$2 AND parent_id=$3 AND revoked_at IS NULL
       RETURNING id,name`,
      [name, req.params.id, req.auth.parent_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Device not found." });
    await audit(req.auth.parent_id, req.params.id, "device_renamed", { name });
    res.json({ ok: true, device: result.rows[0] });
  } catch (err) { next(err); }
});

app.get("/v1/device/status", deviceLimiter, requireDevice, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,name,platform,app_version,sharing_enabled,content_sharing_enabled,last_seen_at,created_at,revoked_at
         FROM devices WHERE id=$1`, [req.device.id]
    );
    const device = rows[0];
    if (!device || device.revoked_at) return res.status(401).json({ error: "Device is not authorized." });
    res.json({ device, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

app.post("/v1/devices/:id/revoke", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `UPDATE devices SET revoked_at=now(), sharing_enabled=false, content_sharing_enabled=false
       WHERE id=$1 AND parent_id=$2 AND revoked_at IS NULL RETURNING id`,
      [id, req.auth.parent_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Device not found." });
    await audit(req.auth.parent_id, id, "device_revoked", {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/v1/settings", requireParent, async (req, res, next) => {
  try {
    const subscription = await getSubscription(req.auth.parent_id);
    res.json({ retentionDays: req.auth.retention_days, subscription });
  } catch (err) { next(err); }
});

app.patch("/v1/settings", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const retentionDays = z.object({ retentionDays: z.union([z.literal(7),z.literal(30),z.literal(60),z.literal(90)]) }).parse(req.body).retentionDays;
    const plan = (await getSubscription(req.auth.parent_id)).plan;
    if (retentionDays > plan.retention) throw httpError(403, `Your current plan includes up to ${plan.retention} days of notification retention.`);
    await pool.query("UPDATE parents SET retention_days=$1,updated_at=now() WHERE id=$2", [retentionDays, req.auth.parent_id]);
    await audit(req.auth.parent_id, null, "retention_changed", { retentionDays });
    res.json({ ok: true, retentionDays });
  } catch (err) { next(err); }
});

app.get("/v1/account/export", requireParent, async (req, res, next) => {
  try {
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
    const confirm = z.object({ confirmation: z.literal("DELETE") }).parse(req.body);
    if (confirm.confirmation !== "DELETE") throw httpError(400, "Type DELETE to confirm account deletion.");
    await tx(async client => {
      await client.query("DELETE FROM audit_log WHERE parent_id=$1", [parentId]);
      await client.query("DELETE FROM webhook_events WHERE parent_id=$1", [parentId]);
      await client.query("DELETE FROM parents WHERE id=$1", [parentId]);
    });
    clearSessionCookies(res);
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

app.post("/v1/billing/subscription", requireParent, requireCsrf, async (req, res, next) => {
  try {
    const planKey = z.object({ planKey: z.enum(["starter","family"]) }).parse(req.body).planKey;
    const plan = planFor(planKey);
    const planId = planKey === "starter" ? process.env.RAZORPAY_PLAN_STARTER : process.env.RAZORPAY_PLAN_FAMILY;
    if (!planId) return res.status(503).json({ error: "Billing is being configured. Please try again later." });

    const subscription = await createRazorpaySubscription({ planId });
    await pool.query(
      `UPDATE subscriptions
          SET plan_key=$1,provider='razorpay',provider_subscription_id=$2,status='created',updated_at=now()
        WHERE parent_id=$3`,
      [plan.key, subscription.id, req.auth.parent_id]
    );
    await audit(req.auth.parent_id, null, "subscription_created", { planKey, providerId: subscription.id });
    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId: subscription.id,
      plan: { key: plan.key, name: plan.name, displayPrice: plan.displayPrice }
    });
  } catch (err) { next(err); }
});

app.get("/v1/events/stream", requireParent, async (req, res) => {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  const keepAlive = setInterval(() => {
    try { res.write(`: keep-alive ${Date.now()}\n\n`); } catch {}
  }, 25_000);
  res.on("close", () => clearInterval(keepAlive));
  addClient(req.auth.parent_id, res);
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
      const plan = effectivePlan(sub[0]);
      const count = await client.query(
        "SELECT COUNT(*)::int AS count FROM devices WHERE parent_id=$1 AND revoked_at IS NULL",
        [parentId]
      );
      if (count.rows[0].count >= plan.devices) throw httpError(403, "Your plan has reached its device limit.");

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

    broadcast(result.parentId, "device.paired", {
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
      contentSharingEnabled: z.boolean().optional()
    }).parse(req.body);

    const result = await pool.query(
      `UPDATE devices SET last_seen_at=now(),app_version=COALESCE($1,app_version),
          sharing_enabled=COALESCE($2,sharing_enabled),
          content_sharing_enabled=COALESCE($3,content_sharing_enabled),updated_at=now()
       WHERE id=$4
       RETURNING id,name,sharing_enabled,content_sharing_enabled,last_seen_at`,
      [input.appVersion || null, input.sharingEnabled, input.contentSharingEnabled, req.device.id]
    );
    res.json({ ok: true, device: result.rows[0], serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

app.post("/v1/device/notifications", deviceLimiter, requireDevice, async (req, res, next) => {
  try {
    if (!req.device.sharing_enabled) {
      return res.status(409).json({ error: "Notification sharing is disabled for this device." });
    }

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

    for (const n of parsed.notifications) {
      if (!req.device.content_sharing_enabled) {
        n.title = null;
        n.body = null;
        n.contentState = "withheld";
      } else if (!n.title && !n.body) {
        n.contentState = "unavailable";
      } else {
        n.contentState = "available";
      }
    }

    const inserted = [];
    await tx(async client => {
      for (const n of parsed.notifications) {
        const result = await client.query(
          `INSERT INTO notifications(
            device_id,parent_id,client_notification_id,notification_key_hash,package_name,app_name,
            notification_type,category,channel_id,group_key,is_ongoing,is_clearable,is_group_summary,content_state,
            title_enc,body_enc,posted_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT(device_id,client_notification_id) DO NOTHING
           RETURNING id,package_name,app_name,notification_type,content_state,posted_at,received_at,read_at`,
          [
            req.device.id, req.device.parent_id, n.clientNotificationId, n.notificationKeyHash,
            n.packageName, n.appName, n.notificationType, n.category, n.channelId, n.groupKey,
            n.isOngoing, n.isClearable, n.isGroupSummary, n.contentState,
            encryptText(n.title), encryptText(n.body), n.postedAt
          ]
        );
        if (result.rowCount) inserted.push(result.rows[0]);
      }
      await client.query("UPDATE devices SET last_seen_at=now(),updated_at=now() WHERE id=$1", [req.device.id]);
    });

    for (const n of inserted) {
      broadcast(req.device.parent_id, "notification", {
        id: n.id,
        appName: n.app_name,
        packageName: n.package_name,
        notificationType: n.notification_type,
        contentState: n.content_state,
        postedAt: n.posted_at,
        deviceId: req.device.id,
        deviceName: req.device.name,
        title: null,
        body: null
      });
    }

    res.status(201).json({ accepted: inserted.length, duplicateOrIgnored: parsed.notifications.length - inserted.length });
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
      const plan = planFromProviderId(entity?.plan_id) || planFor("starter");
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
        await audit(affected[0].parent_id, null, "billing_webhook_applied", { eventType, status, providerSubscriptionId });
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(400).send("invalid webhook");
  }
}

async function getNotifications(parentId, { search = "", unreadOnly = false, limit = 50, offset = 0 } = {}) {
  const values = [parentId];
  const where = ["n.parent_id=$1", "n.deleted_at IS NULL"];
  if (unreadOnly) where.push("n.read_at IS NULL");
  if (search) {
    values.push(`%${search.replace(/[%_]/g, "\\$&")}%`);
    where.push(`(n.app_name ILIKE $${values.length} ESCAPE '\\' OR n.package_name ILIKE $${values.length} ESCAPE '\\')`);
  }
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  values.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT n.id,n.package_name,n.app_name,n.notification_type,n.category,n.channel_id,n.group_key,n.is_ongoing,n.is_clearable,n.is_group_summary,n.content_state,n.title_enc,n.body_enc,n.posted_at,n.received_at,n.read_at,d.id AS device_id,d.name AS device_name
       FROM notifications n JOIN devices d ON d.id=n.device_id
      WHERE ${where.join(" AND ")}
      ORDER BY n.received_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  return {
    items: rows.map(row => ({
      id: row.id,
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
    })),
    hasMore: rows.length === limit
  };
}

async function getSubscription(parentId) {
  const { rows } = await pool.query(
    `SELECT plan_key,status,trial_ends_at,current_period_start,current_period_end,provider_subscription_id
       FROM subscriptions WHERE parent_id=$1`, [parentId]
  );
  const sub = rows[0];
  if (!sub) return { plan: PLANS.trial, status: "trialing" };
  return {
    plan: effectivePlan(sub),
    requestedPlan: planFor(sub.plan_key),
    status: sub.status,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    providerSubscriptionId: sub.provider_subscription_id
  };
}

async function getDeviceLimit(parentId) {
  const subscription = await getSubscription(parentId);
  return subscription.plan.devices;
}

function effectivePlan(sub) {
  if (!sub) return PLANS.trial;
  if (sub.plan_key !== "trial" && ["active","authenticated"].includes(sub.status)) return planFor(sub.plan_key);
  if (sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()) return PLANS.trial;
  return PLANS.trial;
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

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function audit(parentId, deviceId, action, metadata) {
  await pool.query(
    `INSERT INTO audit_log(parent_id,device_id,actor_type,action,metadata)
     VALUES($1,$2,'system',$3,$4)`,
    [parentId, deviceId, action, JSON.stringify(metadata || {})]
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

async function requireParent(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || req.header("x-session-token");
    const session = await getSession(pool, token);
    if (!session) return res.status(401).json({ error: "Authentication required." });
    req.auth = session;
    next();
  } catch (err) { next(err); }
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) return res.status(403).json({ error: "CSRF validation failed." });
  next();
}

async function requireDevice(req, res, next) {
  try {
    const header = req.header("authorization") || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Device authentication required." });
    const tokenHash = sha256(header.slice(7));
    const { rows } = await pool.query(
      `SELECT id,parent_id,name,sharing_enabled,content_sharing_enabled,revoked_at
         FROM devices WHERE device_token_hash=$1`, [tokenHash]
    );
    if (!rows[0] || rows[0].revoked_at) return res.status(401).json({ error: "Device is not authorized." });
    req.device = rows[0];
    next();
  } catch (err) { next(err); }
}

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request.", issues: err.issues });
  console.error(err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Something went wrong." : err.message });
});

app.listen(port, () => console.log(`KidRaksha API listening on ${port}`));

setInterval(async () => {
  try {
    await pool.query("SELECT purge_expired_notifications()");
    await pool.query("DELETE FROM sessions WHERE expires_at<now()");
    await pool.query("DELETE FROM pairing_codes WHERE used_at IS NOT NULL OR expires_at<now()-interval '1 day'");
    await pool.query("UPDATE devices SET sharing_enabled=false WHERE revoked_at IS NOT NULL");
  } catch (err) {
    console.error("maintenance", err);
  }
}, 60 * 60 * 1000).unref();
