
import crypto from "node:crypto";
import { randomToken, sha256, hashPassword, verifyPassword } from "./crypto.js";

const isProduction = process.env.NODE_ENV === "production";
const COOKIE_NAME = isProduction ? "__Host-kidraksha_session" : "kidraksha_session";
const CSRF_COOKIE = isProduction ? "__Host-kidraksha_csrf" : "kidraksha_csrf";
const SESSION_DAYS = 14;
const SESSION_IDLE_HOURS = 8;
const REAUTH_MINUTES = 15;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/"
  };
}

export function publicCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "strict",
    path: "/"
  };
}

export function passwordHash(password) {
  return hashPassword(password);
}

export function passwordMatches(password, encoded) {
  return verifyPassword(password, encoded);
}

export async function createSession(pool, parentId) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO sessions(id,parent_id,token_hash,csrf_token_hash,last_seen_at,last_reauthenticated_at,expires_at)
     VALUES($1,$2,$3,$4,now(),now(),now()+interval '${SESSION_DAYS} days')`,
    [id, parentId, sha256(token), sha256(csrf)]
  );
  return { token, csrf };
}

export async function getSession(pool, token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT s.id, s.parent_id, s.csrf_token, s.csrf_token_hash, s.last_seen_at, s.last_reauthenticated_at,
            p.email, p.display_name, p.retention_days
       FROM sessions s JOIN parents p ON p.id=s.parent_id
      WHERE s.token_hash=$1
        AND s.expires_at>now()
        AND s.last_seen_at>now()-interval '${SESSION_IDLE_HOURS} hours'`,
    [sha256(token)]
  );
  const session = rows[0] || null;
  if (session) {
    // Avoid a write on every request while still extending the server-side idle timer.
    await pool.query(
      `UPDATE sessions SET last_seen_at=now()
        WHERE id=$1 AND last_seen_at < now()-interval '5 minutes'`,
      [session.id]
    );
  }
  return session;
}

export async function deleteSession(pool, token) {
  if (!token) return;
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha256(token)]);
}

export async function refreshSessionActivity(pool, sessionId) {
  if (!sessionId) return false;
  const { rowCount } = await pool.query(
    `UPDATE sessions SET last_seen_at=now()
      WHERE id=$1 AND expires_at>now() AND last_seen_at>now()-interval '${SESSION_IDLE_HOURS} hours'
      RETURNING id`,
    [sessionId]
  );
  return Boolean(rowCount);
}

export async function reauthenticate(pool, sessionId, password, encodedPassword) {
  if (!password || !encodedPassword || !verifyPassword(password, encodedPassword)) return false;
  await pool.query("UPDATE sessions SET last_reauthenticated_at=now(),last_seen_at=now() WHERE id=$1", [sessionId]);
  return true;
}

export function hasRecentReauthentication(session) {
  if (!session?.last_reauthenticated_at) return false;
  return new Date(session.last_reauthenticated_at).getTime() > Date.now() - REAUTH_MINUTES * 60 * 1000;
}

export { COOKIE_NAME, CSRF_COOKIE, REAUTH_MINUTES, SESSION_DAYS, SESSION_IDLE_HOURS };
