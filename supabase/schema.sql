create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

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
  work_type text not null check (work_type in ('normal', 'kitchen_car')),
  break_flag boolean not null default true,
  clock_in timestamptz,
  clock_out timestamptz,
  work_minutes integer,
  overtime_minutes integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_logs_member_date_unique unique (member_id, date),
  constraint attendance_logs_work_minutes_non_negative check (work_minutes is null or work_minutes >= 0),
  constraint attendance_logs_overtime_minutes_non_negative check (overtime_minutes is null or overtime_minutes >= 0)
);

create index if not exists members_key_active_idx on public.members(key, active);
create index if not exists attendance_logs_company_date_idx on public.attendance_logs(company_id, date desc);
create index if not exists attendance_logs_member_date_idx on public.attendance_logs(member_id, date desc);

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

alter table public.companies enable row level security;
alter table public.members enable row level security;
alter table public.attendance_logs enable row level security;

-- The app uses SUPABASE_SERVICE_ROLE_KEY from server-side API routes.
-- Add public/authenticated policies later when login and admin roles are introduced.

