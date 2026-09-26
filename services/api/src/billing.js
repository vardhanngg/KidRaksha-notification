
import crypto from "node:crypto";

export const PLANS = {
  trial: { key: "trial", name: "Trial", devices: 1, retention: 7, pricePaise: 0, displayPrice: "Free for 7 days" },
  starter: { key: "starter", name: "Starter", devices: 1, retention: 30, pricePaise: 19900, displayPrice: "₹199 / month" },
  family: { key: "family", name: "Family", devices: 4, retention: 90, pricePaise: 39900, displayPrice: "₹399 / month" }
};

export function hmacSha256(raw, secret) {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

export function planFor(key) {
  return PLANS[key] || PLANS.trial;
}

export function planFromProviderId(id) {
  if (!id) return null;
  if (id === process.env.RAZORPAY_PLAN_STARTER) return PLANS.starter;
  if (id === process.env.RAZORPAY_PLAN_FAMILY) return PLANS.family;
  return null;
}

export async function createRazorpaySubscription({ planId, totalCount = 120 }) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured");
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, total_count: totalCount, customer_notify: 1 }),
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Razorpay subscription creation timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.description || "Razorpay subscription creation failed");
  return body;
}
