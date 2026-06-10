-- Tenant security hardening for the sales release.
-- Run this after multitenant-rls.sql and the time-edit migrations.
--
-- This migration tightens browser/authenticated RLS. Server API routes that use
-- SUPABASE_SERVICE_ROLE_KEY continue to bypass RLS, so existing API behavior is
-- expected to remain unchanged.
--
-- Production note: set ENABLE_LEGACY_KEY_ACCESS=false before sales release so
-- key-based legacy routes cannot be used as a public access path.

create or replace function public.is_owner_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('owner', 'admin'), false)
$$;

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.time_edit_requests enable row level security;
alter table public.time_edit_histories enable row level security;
alter table public.app_notifications enable row level security;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check
    check (role in ('owner', 'manager', 'admin', 'staff'));

-- profiles: staff can only read self. Profile management is owner/admin or
-- server API only. Staff self-update is intentionally removed to prevent role,
-- company, wage, active, store, and employee-number tampering.
drop policy if exists profiles_select_same_company on public.profiles;
drop policy if exists profiles_owner_insert on public.profiles;
drop policy if exists profiles_owner_or_self_update on public.profiles;
drop policy if exists profiles_owner_delete on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    id = public.get_my_profile_id()
    or public.is_owner_or_admin()
  )
);

create policy profiles_admin_insert
on public.profiles
for insert
to authenticated
with check (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
);

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
)
with check (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
);

create policy profiles_admin_delete
on public.profiles
for delete
to authenticated
using (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
);

-- attendance: staff can read own rows only. Direct staff insert/update/delete is
-- blocked at DB level; clock-in/out and edits remain server API/service-role work.
drop policy if exists attendance_select_by_role on public.attendance;
drop policy if exists attendance_insert_by_role on public.attendance;
drop policy if exists attendance_update_by_role on public.attendance;
drop policy if exists attendance_owner_delete on public.attendance;
drop policy if exists attendance_select_self_or_admin on public.attendance;
drop policy if exists attendance_admin_insert on public.attendance;
drop policy if exists attendance_admin_update on public.attendance;
drop policy if exists attendance_admin_delete on public.attendance;

create policy attendance_select_self_or_admin
on public.attendance
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    user_id = auth.uid()
    or profile_id = public.get_my_profile_id()
    or public.is_owner_or_admin()
  )
);

create policy attendance_admin_insert
on public.attendance
for insert
to authenticated
with check (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = attendance.profile_id
      and p.company_id = public.get_my_company_id()
  )
);

create policy attendance_admin_update
on public.attendance
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
)
with check (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = attendance.profile_id
      and p.company_id = public.get_my_company_id()
  )
);

create policy attendance_admin_delete
on public.attendance
for delete
to authenticated
using (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
);

-- time_edit_requests: staff can create and read own requests only. Staff cannot
-- update/delete requests directly. Owner/admin can review self-company requests.
drop policy if exists time_edit_requests_select_self_or_admin on public.time_edit_requests;
drop policy if exists time_edit_requests_staff_insert on public.time_edit_requests;
drop policy if exists time_edit_requests_admin_update on public.time_edit_requests;
drop policy if exists time_edit_requests_no_delete on public.time_edit_requests;

create policy time_edit_requests_select_self_or_admin
on public.time_edit_requests
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    profile_id = public.get_my_profile_id()
    or public.is_owner_or_admin()
  )
);

create policy time_edit_requests_staff_insert
on public.time_edit_requests
for insert
to authenticated
with check (
  company_id = public.get_my_company_id()
  and profile_id = public.get_my_profile_id()
  and status = 'pending'
  and reviewed_by_profile_id is null
  and reviewed_at is null
  and (
    time_edit_requests.attendance_id is null
    or exists (
      select 1
      from public.attendance a
      where a.id = time_edit_requests.attendance_id
        and a.company_id = public.get_my_company_id()
        and a.profile_id = public.get_my_profile_id()
    )
  )
);

create policy time_edit_requests_admin_update
on public.time_edit_requests
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
)
with check (
  company_id = public.get_my_company_id()
  and public.is_owner_or_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = time_edit_requests.profile_id
      and p.company_id = public.get_my_company_id()
  )
);

-- time_edit_histories: read-only to authenticated users, scoped to self-company
-- and self/admin visibility. Writes are server API/service-role only.
revoke insert, update, delete on public.time_edit_histories from authenticated;

drop policy if exists time_edit_histories_select_self_or_admin on public.time_edit_histories;

create policy time_edit_histories_select_self_or_admin
on public.time_edit_histories
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and (
    profile_id = public.get_my_profile_id()
    or edited_by_profile_id = public.get_my_profile_id()
    or public.is_owner_or_admin()
  )
);

-- app_notifications: users can only see and mark their own notifications. New
-- notifications and deletes are server API/service-role only.
revoke insert, update, delete on public.app_notifications from authenticated;
grant update (read_at) on public.app_notifications to authenticated;

drop policy if exists app_notifications_select_own on public.app_notifications;
drop policy if exists app_notifications_update_own_read_at on public.app_notifications;

create policy app_notifications_select_own
on public.app_notifications
for select
to authenticated
using (
  company_id = public.get_my_company_id()
  and profile_id = public.get_my_profile_id()
);

create policy app_notifications_update_own_read_at
on public.app_notifications
for update
to authenticated
using (
  company_id = public.get_my_company_id()
  and profile_id = public.get_my_profile_id()
)
with check (
  company_id = public.get_my_company_id()
  and profile_id = public.get_my_profile_id()
);
