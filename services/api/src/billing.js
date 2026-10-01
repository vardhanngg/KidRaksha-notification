import crypto from "node:crypto";

export const PLANS = {
  trial: { key: "trial", name: "Trial", devices: 1, retention: 7, pricePaise: 0, displayPrice: "Free for 7 days" },
  weekly: { key: "weekly", name: "Weekly", devices: 1, retention: 7, pricePaise: 4900, displayPrice: "₹49 / week" },
  monthly: { key: "monthly", name: "Monthly", devices: 2, retention: 30, pricePaise: 19900, displayPrice: "₹199 / month" }
};

const LEGACY_PLANS = {
  starter: { key: "starter", name: "Starter", devices: 1, retention: 30, pricePaise: 19900, displayPrice: "₹199 / month", legacy: true },
  family: { key: "family", name: "Family", devices: 4, retention: 90, pricePaise: 39900, displayPrice: "₹399 / month", legacy: true }
};

export function hmacSha256(raw, secret) {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

export function planFor(key) {
  return PLANS[key] || LEGACY_PLANS[key] || PLANS.trial;
}

export function planFromProviderId(id) {
  if (!id) return null;
  if (id === process.env.RAZORPAY_PLAN_WEEKLY) return PLANS.weekly;
  if (id === process.env.RAZORPAY_PLAN_MONTHLY || id === process.env.RAZORPAY_PLAN_STARTER) return PLANS.monthly;
  if (id === process.env.RAZORPAY_PLAN_FAMILY) return LEGACY_PLANS.family;
  return null;
}

export const SUBSCRIPTION_TOTAL_COUNTS = {
  weekly: 520,
  monthly: 120
};

export function subscriptionTotalCountFor(planKey) {
  const totalCount = SUBSCRIPTION_TOTAL_COUNTS[planKey];
  if (!totalCount) throw new Error(`Unsupported subscription plan: ${planKey}`);
  return totalCount;
}

export async function createRazorpaySubscription({ planId, totalCount }) {
  if (!Number.isSafeInteger(totalCount) || totalCount < 1 || totalCount > 520) {
    throw new Error("Razorpay subscription total_count must be an integer from 1 to 520");
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured");
  }
  const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
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
  if (!body || typeof body.id !== "string" || body.id.length < 8 || body.id.length > 200) {
    throw new Error("Razorpay returned an invalid subscription response");
  }
  return body;
}
