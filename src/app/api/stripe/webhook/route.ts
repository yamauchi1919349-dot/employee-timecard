import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase";

const FIXED_MONTHLY_PLAN = "monthly_fixed_3980";
const GRACE_PERIOD_DAYS = 7;

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
      case "invoice.paid":
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
  console.info("[stripe:webhook] checkout.session.completed ids", {
    companyId,
    hasCustomerId: Boolean(customerId),
    hasSubscriptionId: Boolean(subscriptionId),
  });
  const subscription = subscriptionId
    ? await getStripe().subscriptions.retrieve(subscriptionId)
    : null;

  await updateCompanyBilling(companyId, withBillingRecovery({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscription?.status ?? "active",
    current_period_end: subscription ? toTimestamp(getCurrentPeriodEnd(subscription)) : null,
    plan: session.metadata?.plan ?? FIXED_MONTHLY_PLAN,
    billing_email: session.customer_details?.email ?? null,
  }));
}

async function updateCompanyFromSubscription(subscription: Stripe.Subscription) {
  const companyId = await findCompanyIdForSubscription(subscription);
  if (!companyId) return;

  const updates = {
    stripe_customer_id: getStripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    current_period_end: toTimestamp(getCurrentPeriodEnd(subscription)),
    plan: subscription.metadata?.plan ?? FIXED_MONTHLY_PLAN,
  };

  if (subscription.status === "past_due") {
    await startGracePeriod(companyId, updates);
    return;
  }

  await updateCompanyBilling(
    companyId,
    subscription.status === "active" || subscription.status === "trialing"
      ? withBillingRecovery(updates)
      : withGracePeriodCleared(updates),
  );
}

async function handleInvoicePayment(invoice: Stripe.Invoice, result: "payment_succeeded" | "payment_failed") {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const companyId = await findCompanyIdForInvoice(invoice, subscriptionId);
  if (!companyId) return;

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    const updates = {
      stripe_customer_id: getStripeId(subscription.customer),
      stripe_subscription_id: subscription.id,
      subscription_status: result === "payment_failed" ? "past_due" : subscription.status,
      current_period_end: toTimestamp(getCurrentPeriodEnd(subscription)),
      plan: subscription.metadata?.plan ?? FIXED_MONTHLY_PLAN,
    };
    if (result === "payment_failed" || updates.subscription_status === "past_due") {
      await startGracePeriod(companyId, updates);
    } else {
      await updateCompanyBilling(companyId, withBillingRecovery(updates));
    }
    return;
  }

  if (result === "payment_failed") {
    await startGracePeriod(companyId, { subscription_status: "past_due" });
  } else {
    await updateCompanyBilling(companyId, withBillingRecovery({ subscription_status: "active" }));
  }
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
  const { data, error } = await supabase
    .from("companies")
    .update(values)
    .eq("id", companyId)
    .select("id,plan,subscription_status,stripe_customer_id,stripe_subscription_id");
  if (error) throw error;
  if (!data.length) {
    throw new Error(`companies update matched 0 rows for companyId=${companyId}`);
  }

  const updatedCompany = data[0];
  console.info("[stripe:webhook] companies update result", {
    companyId,
    updatedRows: data.length,
    plan: updatedCompany.plan,
    subscription_status: updatedCompany.subscription_status,
    hasStripeCustomerId: Boolean(updatedCompany.stripe_customer_id),
    hasStripeSubscriptionId: Boolean(updatedCompany.stripe_subscription_id),
  });
}

async function startGracePeriod(companyId: string, values: Record<string, string | null>) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("billing_grace_period_started_at,billing_grace_period_ends_at")
    .eq("id", companyId)
    .maybeSingle<{ billing_grace_period_started_at: string | null; billing_grace_period_ends_at: string | null }>();
  if (error) throw error;

  const now = new Date();
  const graceStartedAt = data?.billing_grace_period_started_at ?? now.toISOString();
  const graceEndsAt =
    data?.billing_grace_period_ends_at ??
    new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await updateCompanyBilling(companyId, {
    ...values,
    subscription_status: "past_due",
    billing_grace_period_started_at: graceStartedAt,
    billing_grace_period_ends_at: graceEndsAt,
  });
}

function withBillingRecovery(values: Record<string, string | null>) {
  return {
    ...values,
    billing_grace_period_started_at: null,
    billing_grace_period_ends_at: null,
  };
}

function withGracePeriodCleared(values: Record<string, string | null>) {
  return {
    ...values,
    billing_grace_period_started_at: null,
    billing_grace_period_ends_at: null,
  };
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
