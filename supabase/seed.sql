insert into public.companies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'デモ会社')
on conflict (id) do nothing;

insert into public.members (company_id, key, name, active)
values
  ('00000000-0000-0000-0000-000000000001', 'demo-taro', '山田 太郎', true),
  ('00000000-0000-0000-0000-000000000001', 'demo-hana', '佐藤 花子', true),
  ('00000000-0000-0000-0000-000000000001', 'pato', 'pato', true)
on conflict (company_id, key) do update
set name = excluded.name,
    active = excluded.active;

insert into public.attendance_logs (
  company_id,
  member_id,
  date,
  work_type,
  break_flag,
  clock_in,
  clock_out,
  work_minutes,
  overtime_minutes,
  note
)
select
  m.company_id,
  m.id,
  current_date - 1,
  'normal',
  true,
  (current_date - 1 + time '09:02') at time zone 'Asia/Tokyo',
  (current_date - 1 + time '18:21') at time zone 'Asia/Tokyo',
  499,
  19,
  'seed'
from public.members m
where m.key = 'demo-taro'
on conflict do nothing;

insert into public.attendance_logs (
  company_id,
  member_id,
  date,
  work_type,
  break_flag,
  clock_in,
  clock_out,
  work_minutes,
  overtime_minutes,
  note
)
select
  m.company_id,
  m.id,
  current_date - 2,
  'kitchen_car',
  false,
  (current_date - 2 + time '10:00') at time zone 'Asia/Tokyo',
  (current_date - 2 + time '19:30') at time zone 'Asia/Tokyo',
  570,
  90,
  'seed'
from public.members m
where m.key = 'demo-taro'
on conflict do nothing;

