-- Phase 5: time edit requests, histories, and in-app notifications.
-- Run this in the Supabase SQL Editor for existing environments.

create table if not exists public.time_edit_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  target_date date not null,
  request_type text not null,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  requested_break_minutes integer,
  reason text not null,
  status text not null default 'pending',
  owner_comment text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_edit_requests
  drop constraint if exists time_edit_requests_type_check,
  add constraint time_edit_requests_type_check
    check (request_type in ('missing_clock_in', 'missing_clock_out', 'wrong_time', 'break_fix', 'other'));

alter table public.time_edit_requests
  drop constraint if exists time_edit_requests_status_check,
  add constraint time_edit_requests_status_check
    check (status in ('pending', 'approved', 'rejected'));

alter table public.time_edit_requests
  drop constraint if exists time_edit_requests_break_check,
  add constraint time_edit_requests_break_check
    check (requested_break_minutes is null or (requested_break_minutes >= 0 and requested_break_minutes <= 240));

create table if not exists public.time_edit_histories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  edited_by_profile_id uuid not null references public.profiles(id) on delete set null,
  request_id uuid references public.time_edit_requests(id) on delete set null,
  edit_type text not null,
  before_clock_in timestamptz,
  before_clock_out timestamptz,
  before_break_minutes integer,
  before_work_type text,
  after_clock_in timestamptz,
  after_clock_out timestamptz,
  after_break_minutes integer,
  after_work_type text,
  reason text not null,
  owner_comment text,
  source text not null,
  created_at timestamptz not null default now()
);

alter table public.time_edit_histories
  drop constraint if exists time_edit_histories_source_check,
  add constraint time_edit_histories_source_check
    check (source in ('request', 'direct'));

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  read_at timestamptz,
  related_request_id uuid references public.time_edit_requests(id) on delete set null,
  related_history_id uuid references public.time_edit_histories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists time_edit_requests_company_status_idx
  on public.time_edit_requests(company_id, status, created_at desc);
create index if not exists time_edit_requests_profile_idx
  on public.time_edit_requests(profile_id, created_at desc);
create index if not exists time_edit_histories_company_idx
  on public.time_edit_histories(company_id, created_at desc);
create index if not exists time_edit_histories_profile_idx
  on public.time_edit_histories(profile_id, created_at desc);
create index if not exists app_notifications_profile_read_idx
  on public.app_notifications(profile_id, read_at, created_at desc);

drop trigger if exists time_edit_requests_set_updated_at on public.time_edit_requests;
create trigger time_edit_requests_set_updated_at
before update on public.time_edit_requests
for each row execute function public.set_updated_at();
