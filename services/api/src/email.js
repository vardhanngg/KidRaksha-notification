import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) throw new Error("SMTP is not configured");
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    requireTLS: process.env.SMTP_REQUIRE_TLS !== "false" && port !== 465
  });
  return transporter;
}

export function validateEmailConfig() {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required SMTP configuration: ${missing.join(", ")}`);
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid TCP port");
  if (process.env.SMTP_SECURE === "true" && port !== 465) throw new Error("SMTP_SECURE=true normally requires SMTP_PORT=465");
}

export async function sendPasswordResetEmail({ to, token }) {
  const transport = getTransporter();
  const base = String(process.env.PUBLIC_WEB_ORIGIN || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(base) && process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_WEB_ORIGIN must use HTTPS");
  }
  const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Reset your KidSuraksha password",
    text: [
      "We received a request to reset your KidSuraksha password.",
      "",
      `Reset your password: ${url}`,
      "",
      "This link expires in 30 minutes and can be used once.",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: `<p>We received a request to reset your KidSuraksha password.</p><p><a href="${url}">Reset your password</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request this, you can ignore this email.</p>`
  });
}
