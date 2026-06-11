export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export type BillingStatusInput = {
  subscription_status?: string | null;
  billing_grace_period_ends_at?: string | null;
} | string | null | undefined;

export function isCompanySubscriptionActive(input?: BillingStatusInput) {
  const status = typeof input === "string" || !input ? input : input.subscription_status;
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(status ?? "")) return true;
  if (status !== "past_due" || typeof input === "string" || !input?.billing_grace_period_ends_at) return false;
  return new Date(input.billing_grace_period_ends_at).getTime() > Date.now();
}

export function isBillingGracePeriodActive(input?: BillingStatusInput) {
  const status = typeof input === "string" || !input ? input : input.subscription_status;
  return status === "past_due" && isCompanySubscriptionActive(input);
}

export function getBillingRestrictionMessage() {
  return "ArcNest Timecardを利用するには、管理者によるお支払い確認が必要です。";
}
