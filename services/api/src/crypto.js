
import crypto from "node:crypto";

const encryptionKey = process.env.DATA_ENCRYPTION_KEY
  ? Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64")
  : null;

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmac(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString("base64");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, encoded) {
  const [, salt, expected] = String(encoded).split("$");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString("base64");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function encryptText(text) {
  if (!text) return null;
  if (!encryptionKey || encryptionKey.length !== 32) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY must be a 32-byte base64 key");
    return text;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decryptText(value) {
  if (!value) return "";
  if (!value.includes(".")) return process.env.NODE_ENV === "production" ? "" : value;
  if (!encryptionKey || encryptionKey.length !== 32) throw new Error("DATA_ENCRYPTION_KEY missing");
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function timingSafeEqualHex(a, b) {
  const aa = Buffer.from(String(a), "hex");
  const bb = Buffer.from(String(b), "hex");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
