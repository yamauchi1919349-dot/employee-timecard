import { NextResponse } from "next/server";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { normalizeRole } from "@/lib/time-edit";

const FIXED_MONTHLY_PLAN = "monthly_fixed_3980";

export async function POST(request: Request) {
  try {
    const owner = await getAuthenticatedProfile(request);
    if (!owner) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    if (normalizeRole(owner.role) !== "owner") {
      return NextResponse.json({ message: "支払い管理はownerのみ実行できます。" }, { status: 403 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ message: "STRIPE_PRICE_IDが設定されていません。" }, { status: 500 });
    }

    const supabase = createSupabaseAdmin();
    const { data: company, error } = await supabase
      .from("companies")
      .select("id,name,stripe_customer_id,billing_email")
      .eq("id", owner.company_id)
      .maybeSingle<{
        id: string;
        name: string;
        stripe_customer_id: string | null;
        billing_email: string | null;
      }>();
    if (error) throw error;
    if (!company) return NextResponse.json({ message: "会社情報が見つかりません。" }, { status: 404 });

    const stripe = getStripe();
    const appUrl = getAppUrl(request);
    const billingEmail = company.billing_email ?? owner.email ?? undefined;
    let customerId = company.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company.name,
        email: billingEmail,
        metadata: {
          company_id: company.id,
        },
      });
      customerId = customer.id;

      await supabase
        .from("companies")
        .update({
          stripe_customer_id: customerId,
          billing_email: billingEmail ?? null,
          plan: FIXED_MONTHLY_PLAN,
        })
        .eq("id", company.id);
    }

    const successUrl = `${appUrl}/dashboard?checkout=success`;
    const cancelUrl = `${appUrl}/dashboard?checkout=cancel`;

    console.info("[billing:create-checkout-session] Stripe Checkout URLs", {
      baseUrl: appUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: company.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        company_id: company.id,
        plan: FIXED_MONTHLY_PLAN,
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          company_id: company.id,
          plan: FIXED_MONTHLY_PLAN,
          // Future extension point: add a metered or quantity item for staff_count * 100 JPY.
          billing_model: "fixed_monthly",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ message: "Stripe Checkout URLを作成できませんでした。" }, { status: 500 });
    }

    return NextResponse.json({
      url: session.url,
      checkoutUrls: {
        baseUrl: appUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Checkoutセッション作成に失敗しました。" },
      { status: 500 },
    );
  }
}
