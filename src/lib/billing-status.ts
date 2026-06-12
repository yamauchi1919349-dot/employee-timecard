export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);
export const PAID_BILLING_PLANS = new Set(["monthly_fixed_3980"]);

export type BillingStatusInput = {
  plan?: string | null;
  subscription_status?: string | null;
  billing_grace_period_ends_at?: string | null;
} | string | null | undefined;

export function isCompanySubscriptionActive(input?: BillingStatusInput) {
  const status = typeof input === "string" || !input ? input : input.subscription_status;
  const plan = typeof input === "string" || !input ? null : input.plan;
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status ?? "")) return false;
  if (typeof input === "string") return true;
  return PAID_BILLING_PLANS.has(plan ?? "");
}

export function isBillingGracePeriodActive(input?: BillingStatusInput) {
  const status = typeof input === "string" || !input ? input : input.subscription_status;
  if (status !== "past_due" || typeof input === "string" || !input?.billing_grace_period_ends_at) return false;
  return new Date(input.billing_grace_period_ends_at).getTime() > Date.now();
}

export function getBillingRestrictionMessage() {
  return "ArcNest Timecardを利用するには、管理者によるお支払い確認が必要です。";
}
