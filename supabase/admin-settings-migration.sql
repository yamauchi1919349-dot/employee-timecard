-- Phase 4: company-level admin settings.
-- Run this in the Supabase SQL Editor for existing environments.

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
