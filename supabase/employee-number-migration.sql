alter table public.profiles
  add column if not exists employee_number text;

create index if not exists profiles_company_employee_number_idx
  on public.profiles(company_id, employee_number)
  where employee_number is not null;
