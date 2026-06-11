-- Billing grace period columns for payment failures.
-- past_due companies can continue using the app until billing_grace_period_ends_at.
alter table public.companies
  add column if not exists billing_grace_period_started_at timestamptz,
  add column if not exists billing_grace_period_ends_at timestamptz;

create index if not exists companies_billing_grace_period_ends_at_idx
  on public.companies(billing_grace_period_ends_at)
  where billing_grace_period_ends_at is not null;

