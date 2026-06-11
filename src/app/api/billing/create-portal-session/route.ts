import { NextResponse } from "next/server";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { normalizeRole } from "@/lib/time-edit";

export async function POST(request: Request) {
  try {
    const owner = await getAuthenticatedProfile(request);
    if (!owner) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    if (normalizeRole(owner.role) !== "owner") {
      return NextResponse.json({ message: "支払い管理はownerのみ実行できます。" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data: company, error } = await supabase
      .from("companies")
      .select("id,stripe_customer_id")
      .eq("id", owner.company_id)
      .maybeSingle<{ id: string; stripe_customer_id: string | null }>();
    if (error) throw error;
    if (!company?.stripe_customer_id) {
      return NextResponse.json({ message: "Stripe顧客情報がまだ作成されていません。" }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${getAppUrl()}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Customer Portal作成に失敗しました。" },
      { status: 500 },
    );
  }
}

