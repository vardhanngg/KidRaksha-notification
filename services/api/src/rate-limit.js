import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import logger from "./logger.js";

let redisClient = null;
let redisReady = null;

function makeStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `kidraksha:${prefix}:`,
    sendCommand: (...args) => redisClient.sendCommand(args)
  });
}

export function createRateLimiters() {
  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000 } });
    redisClient.on("error", (err) => logger.error({ err }, "rate_limit_redis_error"));
    redisReady = redisClient.connect().catch((err) => {
      logger.error({ err }, "rate_limit_redis_connect_failed");
      throw err;
    });
  }
  const standard = { standardHeaders: "draft-8", legacyHeaders: false };
  return {
    authLimiter: rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, ...standard, store: makeStore("auth") }),
    pairingLimiter: rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, ...standard, store: makeStore("pairing") }),
    deviceLimiter: rateLimit({ windowMs: 60 * 1000, limit: 120, ...standard, store: makeStore("device") }),
    parentApiLimiter: rateLimit({ windowMs: 60 * 1000, limit: 180, ...standard, store: makeStore("parent-api") }),
    eventStreamLimiter: rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, ...standard, store: makeStore("events") })
  };
}

export async function waitForRateLimiter() {
  if (redisReady) await redisReady;
}

export async function closeRateLimiter() {
  try { await redisReady; } catch {}
  if (redisClient?.isOpen) await redisClient.quit();
  redisClient = null;
  redisReady = null;
}
