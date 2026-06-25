import { NextResponse } from "next/server";
import { createSupabaseAdmin, type AuthProfile } from "@/lib/supabase";
import { getBillingRestrictionMessage, isCompanySubscriptionActive } from "@/lib/billing-status";
import { isDeveloperProfile } from "@/lib/developer-mode";

export async function requireActiveCompanySubscription(profile: AuthProfile) {
  if (isDeveloperProfile(profile)) return null;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("plan,subscription_status,billing_grace_period_ends_at")
    .eq("id", profile.company_id)
    .maybeSingle<{ plan: string | null; subscription_status: string | null; billing_grace_period_ends_at: string | null }>();

  if (error) throw error;

  if (isCompanySubscriptionActive(data)) return null;

  return NextResponse.json(
    {
      message: getBillingRestrictionMessage(),
      plan: data?.plan ?? null,
      subscription_status: data?.subscription_status ?? null,
      billing_grace_period_ends_at: data?.billing_grace_period_ends_at ?? null,
    },
    { status: 402 },
  );
}
