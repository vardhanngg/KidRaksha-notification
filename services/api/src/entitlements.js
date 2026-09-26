import { PLANS, planFor } from "./billing.js";

export function subscriptionAccess(sub, now = new Date()) {
  if (!sub) return { state: "none", entitled: false, plan: PLANS.trial };
  const status = String(sub.status || "").toLowerCase();
  if (sub.plan_key !== "trial" && ["active", "authenticated"].includes(status)) {
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    if (!periodEnd || periodEnd > now) return { state: "paid", entitled: true, plan: planFor(sub.plan_key) };
  }
  if (sub.plan_key === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) > now) {
    return { state: "trial", entitled: true, plan: PLANS.trial };
  }
  return { state: "expired", entitled: false, plan: PLANS.trial };
}

export function effectivePlan(sub, now = new Date()) {
  return subscriptionAccess(sub, now).plan;
}
