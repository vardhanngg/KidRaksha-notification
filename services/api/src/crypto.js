import crypto from "node:crypto";

const SCRYPT_N = 131_072; // OWASP current minimum recommendation for scrypt.
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

function loadKey(raw) {
  if (!raw) return null;
  try {
    const value = Buffer.from(raw, "base64");
    return value.length === 32 ? value : null;
  } catch {
    return null;
  }
}

function encryptionKeys() {
  return [
    loadKey(process.env.DATA_ENCRYPTION_KEY),
    loadKey(process.env.DATA_ENCRYPTION_KEY_PREVIOUS)
  ].filter(Boolean);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function hmac(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = crypto.scryptSync(String(password), salt, 64, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM
  }).toString("base64");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

function parsePasswordHash(encoded) {
  const parts = String(encoded || "").split("$");
  if (parts[0] !== "scrypt") return null;
  if (parts.length === 6) {
    const [, n, r, p, salt, expected] = parts;
    return { n: Number(n), r: Number(r), p: Number(p), salt, expected, legacy: false };
  }
  if (parts.length === 3) {
    const [, salt, expected] = parts;
    return { n: 16_384, r: 8, p: 1, salt, expected, legacy: true };
  }
  return null;
}

export function verifyPassword(password, encoded) {
  const parsed = parsePasswordHash(encoded);
  if (!parsed || !Number.isInteger(parsed.n) || !Number.isInteger(parsed.r) || !Number.isInteger(parsed.p)) return false;
  if (parsed.n < 2 || parsed.r < 1 || parsed.p < 1 || parsed.n > 1_048_576) return false;
  try {
    const actual = crypto.scryptSync(String(password), parsed.salt, 64, {
      N: parsed.n, r: parsed.r, p: parsed.p, maxmem: SCRYPT_MAXMEM
    });
    const expected = Buffer.from(parsed.expected, "base64");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(encoded) {
  const parsed = parsePasswordHash(encoded);
  return !parsed || parsed.n < SCRYPT_N || parsed.r !== SCRYPT_R || parsed.p !== SCRYPT_P || parsed.legacy;
}

function encryptWithKey(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function encryptText(text) {
  if (!text) return null;
  const keys = encryptionKeys();
  if (!keys[0]) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY must be a 32-byte base64 key");
    return text;
  }
  // v2 means new data is always encrypted under the current key. Previous keys remain for rotation.
  return `v2.${encryptWithKey(text, keys[0])}`;
}

function decryptWithKey(raw, key) {
  const [ivRaw, tagRaw, ciphertextRaw] = raw.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted value");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function decryptText(value) {
  if (!value) return "";
  if (!value.includes(".")) return process.env.NODE_ENV === "production" ? "" : value;
  const raw = String(value);
  if (raw.startsWith("v2.")) {
    const payload = raw.slice(3);
    for (const key of encryptionKeys()) {
      try { return decryptWithKey(payload, key); } catch {}
    }
    throw new Error("Encrypted value could not be decrypted with configured keys");
  }
  // v1/legacy values did not carry a version marker. Try current then previous key for seamless rotation.
  const keys = encryptionKeys();
  if (!keys.length) throw new Error("DATA_ENCRYPTION_KEY missing");
  for (const key of keys) {
    try { return decryptWithKey(raw, key); } catch {}
  }
  if (process.env.NODE_ENV !== "production") return raw;
  throw new Error("Encrypted value could not be decrypted with configured keys");
}

export function timingSafeEqualHex(a, b) {
  const aa = Buffer.from(String(a), "hex");
  const bb = Buffer.from(String(b), "hex");
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

export { SCRYPT_N, SCRYPT_R, SCRYPT_P };
