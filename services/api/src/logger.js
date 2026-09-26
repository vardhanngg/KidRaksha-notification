import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "kidraksha-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-session-token']",
      "password",
      "passwordHash",
      "deviceToken",
      "token",
      "csrf"
    ],
    censor: "[REDACTED]"
  }
});

export default logger;
