import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";

const FIXED_MONTHLY_PLAN = "monthly_fixed_3980";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ message: "STRIPE_WEBHOOK_SECRET is not set." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Missing stripe-signature header." }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid Stripe webhook signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateCompanyFromSubscription(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePayment(event.data.object, "payment_succeeded");
        break;
      case "invoice.payment_failed":
        await handleInvoicePayment(event.data.object, "payment_failed");
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Stripe webhook handling failed." },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const companyId = session.metadata?.company_id ?? session.client_reference_id;
  if (!companyId) return;

  const subscriptionId = getStripeId(session.subscription);
  const customerId = getStripeId(session.customer);
  const subscription = subscriptionId
    ? await getStripe().subscriptions.retrieve(subscriptionId)
    : null;

  await updateCompanyBilling(companyId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscription?.status ?? "active",
    current_period_end: subscription ? toTimestamp(getCurrentPeriodEnd(subscription)) : null,
    plan: session.metadata?.plan ?? FIXED_MONTHLY_PLAN,
    billing_email: session.customer_details?.email ?? null,
  });
}

async function updateCompanyFromSubscription(subscription: Stripe.Subscription) {
  const companyId = await findCompanyIdForSubscription(subscription);
  if (!companyId) return;

  await updateCompanyBilling(companyId, {
    stripe_customer_id: getStripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    current_period_end: toTimestamp(getCurrentPeriodEnd(subscription)),
    plan: subscription.metadata?.plan ?? FIXED_MONTHLY_PLAN,
  });
}

async function handleInvoicePayment(invoice: Stripe.Invoice, result: "payment_succeeded" | "payment_failed") {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const companyId = await findCompanyIdForInvoice(invoice, subscriptionId);
  if (!companyId) return;

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await updateCompanyBilling(companyId, {
      stripe_customer_id: getStripeId(subscription.customer),
      stripe_subscription_id: subscription.id,
      subscription_status: result === "payment_failed" ? "past_due" : subscription.status,
      current_period_end: toTimestamp(getCurrentPeriodEnd(subscription)),
      plan: subscription.metadata?.plan ?? FIXED_MONTHLY_PLAN,
    });
    return;
  }

  await updateCompanyBilling(companyId, {
    subscription_status: result === "payment_failed" ? "past_due" : "active",
  });
}

async function findCompanyIdForSubscription(subscription: Stripe.Subscription) {
  const metadataCompanyId = subscription.metadata?.company_id;
  if (metadataCompanyId) return metadataCompanyId;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${getStripeId(subscription.customer)}`)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

async function findCompanyIdForInvoice(invoice: Stripe.Invoice, subscriptionId: string | null) {
  const metadataCompanyId = invoice.parent?.subscription_details?.metadata?.company_id ?? invoice.metadata?.company_id;
  if (metadataCompanyId) return metadataCompanyId;

  const customerId = getStripeId(invoice.customer);
  const filters = [
    subscriptionId ? `stripe_subscription_id.eq.${subscriptionId}` : null,
    customerId ? `stripe_customer_id.eq.${customerId}` : null,
  ].filter(Boolean);
  if (!filters.length) return null;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .or(filters.join(","))
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

async function updateCompanyBilling(companyId: string, values: Record<string, string | null>) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("companies")
    .update(values)
    .eq("id", companyId);
  if (error) throw error;
}

function getStripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  return getStripeId(parentSubscription ?? null);
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const payload = subscription as unknown as { current_period_end?: number | null };
  return payload.current_period_end ?? null;
}

function toTimestamp(unixSeconds: number | null | undefined) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}
