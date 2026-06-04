create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_rounding_minutes integer not null default 15,
  rounding_method text not null default 'nearest',
  overtime_threshold_minutes integer not null default 480,
  include_payroll boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists work_rounding_minutes integer not null default 15,
  add column if not exists rounding_method text not null default 'nearest',
  add column if not exists overtime_threshold_minutes integer not null default 480,
  add column if not exists include_payroll boolean not null default false;

alter table public.companies
  drop constraint if exists companies_work_rounding_minutes_check,
  add constraint companies_work_rounding_minutes_check
    check (work_rounding_minutes in (0, 5, 10, 15, 30));

alter table public.companies
  drop constraint if exists companies_rounding_method_check,
  add constraint companies_rounding_method_check
    check (rounding_method in ('floor', 'ceil', 'nearest'));

alter table public.companies
  drop constraint if exists companies_overtime_threshold_minutes_check,
  add constraint companies_overtime_threshold_minutes_check
    check (overtime_threshold_minutes >= 60 and overtime_threshold_minutes <= 1440);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint members_company_key_unique unique (company_id, key)
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  staff_id text,
  staff_name text,
  work_type text not null check (work_type in ('normal', 'kitchen_car')),
  break_flag boolean not null default true,
  clock_in timestamptz,
  clock_out timestamptz,
  work_minutes integer,
  overtime_minutes integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_logs_work_minutes_non_negative check (work_minutes is null or work_minutes >= 0),
  constraint attendance_logs_overtime_minutes_non_negative check (overtime_minutes is null or overtime_minutes >= 0)
);

create table if not exists public.member_calendar_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  staff_id text,
  date date not null,
  day_type text not null check (day_type in ('workday', 'holiday')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pdf_email_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  staff_id text,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_logs
  add column if not exists staff_id text,
  add column if not exists staff_name text;

alter table public.attendance_logs
  drop constraint if exists attendance_logs_member_date_unique;

create index if not exists members_key_active_idx on public.members(key, active);
create index if not exists attendance_logs_company_date_idx on public.attendance_logs(company_id, date desc);
create index if not exists attendance_logs_member_date_idx on public.attendance_logs(member_id, date desc);
create index if not exists attendance_logs_member_staff_date_idx on public.attendance_logs(member_id, staff_id, date desc);
create unique index if not exists attendance_logs_member_date_unique_null_staff
  on public.attendance_logs(member_id, date)
  where staff_id is null;
create unique index if not exists attendance_logs_member_staff_date_unique
  on public.attendance_logs(member_id, staff_id, date)
  where staff_id is not null;
create index if not exists member_calendar_days_company_date_idx on public.member_calendar_days(company_id, date desc);
create index if not exists member_calendar_days_member_date_idx on public.member_calendar_days(member_id, date desc);
create index if not exists member_calendar_days_member_staff_date_idx on public.member_calendar_days(member_id, staff_id, date desc);
create unique index if not exists member_calendar_days_member_date_unique_null_staff
  on public.member_calendar_days(company_id, member_id, date)
  where staff_id is null;
create unique index if not exists member_calendar_days_member_staff_date_unique
  on public.member_calendar_days(company_id, member_id, staff_id, date)
  where staff_id is not null;
create index if not exists pdf_email_recipients_member_staff_active_idx
  on public.pdf_email_recipients(member_id, staff_id, active);
create unique index if not exists pdf_email_recipients_member_email_unique_null_staff
  on public.pdf_email_recipients(company_id, member_id, (lower(email)))
  where staff_id is null and active = true;
create unique index if not exists pdf_email_recipients_member_staff_email_unique
  on public.pdf_email_recipients(company_id, member_id, staff_id, (lower(email)))
  where staff_id is not null and active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendance_logs_set_updated_at on public.attendance_logs;
create trigger attendance_logs_set_updated_at
before update on public.attendance_logs
for each row
execute function public.set_updated_at();

drop trigger if exists member_calendar_days_set_updated_at on public.member_calendar_days;
create trigger member_calendar_days_set_updated_at
before update on public.member_calendar_days
for each row
execute function public.set_updated_at();

drop trigger if exists pdf_email_recipients_set_updated_at on public.pdf_email_recipients;
create trigger pdf_email_recipients_set_updated_at
before update on public.pdf_email_recipients
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.members enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.member_calendar_days enable row level security;
alter table public.pdf_email_recipients enable row level security;

-- The app uses SUPABASE_SERVICE_ROLE_KEY from server-side API routes.
-- Add public/authenticated policies later when login and admin roles are introduced.

