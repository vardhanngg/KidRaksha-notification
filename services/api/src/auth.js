
import crypto from "node:crypto";
import { randomToken, sha256, hashPassword, verifyPassword } from "./crypto.js";

const COOKIE_NAME = "kidraksha_session";
const CSRF_COOKIE = "kidraksha_csrf";
const SESSION_DAYS = 14;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}

export function publicCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
    `INSERT INTO sessions(id,parent_id,token_hash,csrf_token,expires_at) VALUES($1,$2,$3,$4,now()+interval '${SESSION_DAYS} days')`,
    [id, parentId, sha256(token), csrf]
  );
  return { token, csrf };
}

export async function getSession(pool, token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT s.id, s.parent_id, s.csrf_token, p.email, p.display_name, p.retention_days
       FROM sessions s JOIN parents p ON p.id=s.parent_id
      WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [sha256(token)]
  );
  return rows[0] || null;
}

export async function deleteSession(pool, token) {
  if (!token) return;
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha256(token)]);
}

export { COOKIE_NAME, CSRF_COOKIE };
