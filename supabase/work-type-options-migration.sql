-- Update attendance work_type values for the sales timecard flow.
-- paid_leave remains allowed only for existing legacy rows; it is not shown as a selectable option.
alter table public.attendance
  drop constraint if exists attendance_work_type_check,
  add constraint attendance_work_type_check
    check (work_type in (
      'normal',
      'paid_leave',
      'holiday_work',
      'late',
      'early_leave',
      'half_day',
      'other'
    ));
