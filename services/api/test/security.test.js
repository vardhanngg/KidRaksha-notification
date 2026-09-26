import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { hashPassword, verifyPassword, passwordNeedsRehash, encryptText, decryptText, timingSafeEqualHex, sha256 } from "../src/crypto.js";
import { cookieOptions, publicCsrfCookieOptions, hasRecentReauthentication, REAUTH_MINUTES } from "../src/auth.js";

test("new password hashes use stronger scrypt parameters", () => {
  const hash = hashPassword("A secure password 123!");
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(verifyPassword("A secure password 123!", hash), true);
  assert.equal(passwordNeedsRehash(hash), false);
});

test("legacy password hashes remain verifiable and request a rehash", () => {
  const salt = "legacy-salt";
  const derived = crypto.scryptSync("legacy-password", salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("base64");
  const hash = `scrypt$${salt}$${derived}`;
  assert.equal(verifyPassword("legacy-password", hash), true);
  assert.equal(passwordNeedsRehash(hash), true);
});

test("timing-safe hex comparison rejects length mismatch", () => {
  assert.equal(timingSafeEqualHex(sha256("a"), sha256("b")), false);
  assert.equal(timingSafeEqualHex(sha256("a"), sha256("a")), true);
});

test("versioned encrypted data round-trips", () => {
  process.env.NODE_ENV = "test";
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.DATA_ENCRYPTION_KEY_PREVIOUS = "";
  const encrypted = encryptText("private notification body");
  assert.match(encrypted, /^v2\./);
  assert.equal(decryptText(encrypted), "private notification body");
});


test("browser session cookies are Strict and not readable for the session token", () => {
  const session = cookieOptions();
  const csrf = publicCsrfCookieOptions();
  assert.equal(session.httpOnly, true);
  assert.equal(session.sameSite, "strict");
  assert.equal(session.path, "/");
  assert.equal(csrf.httpOnly, false);
  assert.equal(csrf.sameSite, "strict");
  assert.equal(csrf.path, "/");
});

test("recent reauthentication expires on the server-side window", () => {
  const recent = { last_reauthenticated_at: new Date(Date.now() - (REAUTH_MINUTES - 1) * 60 * 1000).toISOString() };
  const stale = { last_reauthenticated_at: new Date(Date.now() - (REAUTH_MINUTES + 1) * 60 * 1000).toISOString() };
  assert.equal(hasRecentReauthentication(recent), true);
  assert.equal(hasRecentReauthentication(stale), false);
});
