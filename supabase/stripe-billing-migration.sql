-- Stripe Billing columns for company-level subscriptions.
-- Initial billing is fixed monthly 3,980 JPY tax-inclusive.
-- Staff-count billing can be added later by using plan plus Stripe subscription items.
alter table public.companies
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists plan text,
  add column if not exists billing_email text;

create index if not exists companies_stripe_customer_id_idx
  on public.companies(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists companies_stripe_subscription_id_idx
  on public.companies(stripe_subscription_id)
  where stripe_subscription_id is not null;

