-- Multitenant + Supabase Auth/RLS migration for the sales version.
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Existing key-based rows are kept. Map them to profiles/user_id after creating Auth users.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists plan text not null default 'free';

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  name text not null,
  email text,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  constraint profiles_user_id_unique unique (user_id),
  constraint profiles_role_check check (role in ('owner', 'manager', 'staff'))
);

alter table public.profiles
  add column if not exists email text;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  clock_in timestamptz,
  clock_out timestamptz,
  work_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bridge columns for the current app tables.
alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.attendance_logs
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.member_calendar_days
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists store_id uuid references public.stores(id) on delete set null;

alter table public.pdf_email_recipients
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists stores_company_id_idx on public.stores(company_id);
create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists profiles_store_id_idx on public.profiles(store_id);
create index if not exists profiles_user_id_idx on public.profiles(user_id);
create unique index if not exists profiles_company_email_unique
  on public.profiles(company_id, lower(email))
  where email is not null;
create index if not exists attendance_company_work_date_idx on public.attendance(company_id, work_date);
create index if not exists attendance_user_work_date_idx on public.attendance(user_id, work_date);
create index if not exists attendance_profile_work_date_idx on public.attendance(profile_id, work_date);
create index if not exists attendance_logs_user_date_idx on public.attendance_logs(user_id, date);
create index if not exists attendance_logs_profile_date_idx on public.attendance_logs(profile_id, date);
create index if not exists member_calendar_days_profile_date_idx on public.member_calendar_days(profile_id, date);
create index if not exists pdf_email_recipients_profile_idx on public.pdf_email_recipients(profile_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

-- RLS-safe helpers. These functions intentionally derive tenant identity from auth.uid().
create or replace function public.get_my_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select p
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'owner', false)
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('owner', 'manager'), false)
$$;

alter table public.companies enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.members enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.member_calendar_days enable row level security;
alter table public.pdf_email_recipients enable row level security;

drop policy if exists companies_select_same_company on public.companies;
create policy companies_select_same_company
on public.companies
for select
to authenticated
using (id = public.get_my_company_id());

drop policy if exists companies_owner_update on public.companies;
create policy companies_owner_update
on public.companies
for update
to authenticated
using (id = public.get_my_company_id() and public.is_owner())
with check (id = public.get_my_company_id() and public.is_owner());

drop policy if exists profiles_select_same_company on public.profiles;
create policy profiles_select_same_company
on public.profiles
for select
to authenticated
using (company_id = public.get_my_company_id());

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert
on public.profiles
for insert
to authenticated
with check (company_id = public.get_my_company_id() and public.is_owner());

drop policy if exists profiles_owner_or_self_update on public.profiles;
create policy profiles_owner_or_self_update
on public.profiles
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and (public.is_owner() or user_id = auth.uid())
)
with check (
  company_id = public.get_my_company_id()
  and (public.is_owner() or user_id = auth.uid())
);

drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete
on public.profiles
for delete
to authenticated
using (company_id = public.get_my_company_id() and public.is_owner());

drop policy if exists stores_select_same_company on public.stores;
create policy stores_select_same_company
on public.stores
for select
to authenticated
using (company_id = public.get_my_company_id());

drop policy if exists stores_manager_manage on public.stores;
create policy stores_manager_manage
on public.stores
for all
to authenticated
using (company_id = public.get_my_company_id() and public.is_manager_or_owner())
with check (company_id = public.get_my_company_id() and public.is_manager_or_owner());

drop policy if exists attendance_select_by_role on public.attendance;
create policy attendance_select_by_role
on public.attendance
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_insert_by_role on public.attendance;
create policy attendance_insert_by_role
on public.attendance
for insert
to authenticated
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_update_by_role on public.attendance;
create policy attendance_update_by_role
on public.attendance
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
)
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_owner_delete on public.attendance;
create policy attendance_owner_delete
on public.attendance
for delete
to authenticated
using (company_id = public.get_my_company_id() and public.is_owner());

drop policy if exists members_select_same_company on public.members;
create policy members_select_same_company
on public.members
for select
to authenticated
using (company_id = public.get_my_company_id());

drop policy if exists members_manager_manage on public.members;
create policy members_manager_manage
on public.members
for all
to authenticated
using (company_id = public.get_my_company_id() and public.is_manager_or_owner())
with check (company_id = public.get_my_company_id() and public.is_manager_or_owner());

drop policy if exists attendance_logs_select_by_role on public.attendance_logs;
create policy attendance_logs_select_by_role
on public.attendance_logs
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_logs_insert_by_role on public.attendance_logs;
create policy attendance_logs_insert_by_role
on public.attendance_logs
for insert
to authenticated
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_logs_update_by_role on public.attendance_logs;
create policy attendance_logs_update_by_role
on public.attendance_logs
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
)
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists attendance_logs_owner_delete on public.attendance_logs;
create policy attendance_logs_owner_delete
on public.attendance_logs
for delete
to authenticated
using (company_id = public.get_my_company_id() and public.is_owner());

drop policy if exists calendar_days_select_by_role on public.member_calendar_days;
create policy calendar_days_select_by_role
on public.member_calendar_days
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists calendar_days_manage_by_role on public.member_calendar_days;
create policy calendar_days_manage_by_role
on public.member_calendar_days
for all
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
)
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists pdf_recipients_select_by_role on public.pdf_email_recipients;
create policy pdf_recipients_select_by_role
on public.pdf_email_recipients
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

drop policy if exists pdf_recipients_manage_by_role on public.pdf_email_recipients;
create policy pdf_recipients_manage_by_role
on public.pdf_email_recipients
for all
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
)
with check (
  company_id = public.get_my_company_id()
  and (
    public.is_manager_or_owner()
    or user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
  )
);

-- Migration guide for existing rows:
-- 1. Create Supabase Auth users.
-- 2. Insert one profile per Auth user with the correct company_id and role.
-- 3. Map legacy members/attendance rows to profiles when ready, for example:
--    update public.members
--    set user_id = '<auth-user-id>', profile_id = '<profile-id>'
--    where key = 'yamauchi';
--    update public.attendance_logs
--    set user_id = '<auth-user-id>', profile_id = '<profile-id>'
--    where member_id = '<legacy-member-id>';
-- 4. Keep ENABLE_LEGACY_KEY_ACCESS=true during migration.
-- 5. Set ENABLE_LEGACY_KEY_ACCESS=false in production when login-only operation starts.
