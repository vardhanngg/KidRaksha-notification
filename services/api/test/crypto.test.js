import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "development";
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const { hashPassword, verifyPassword, encryptText, decryptText, randomToken, sha256 } = await import("../src/crypto.js");

test("password hashing is salted and verifiable", () => {
  const encoded = hashPassword("a-long-demo-password");
  assert.notEqual(encoded, "a-long-demo-password");
  assert.equal(verifyPassword("a-long-demo-password", encoded), true);
  assert.equal(verifyPassword("wrong-password", encoded), false);
});

test("notification content encrypts and decrypts", () => {
  const value = encryptText("Private message 123");
  assert.ok(value && value.includes("."));
  assert.equal(decryptText(value), "Private message 123");
});

test("tokens are random and hashes are deterministic", () => {
  assert.notEqual(randomToken(), randomToken());
  assert.equal(sha256("abc"), sha256("abc"));
});
