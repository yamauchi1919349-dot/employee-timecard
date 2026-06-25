export type WorkType = "normal" | "kitchen_car";
export type SalesWorkType =
  | "normal"
  | "paid_leave"
  | "holiday_work"
  | "late"
  | "early_leave"
  | "half_day"
  | "other";
export type AttendanceStatus = "not_clocked_in" | "working" | "clocked_out";
export type CalendarDayType = "workday" | "holiday";
export type SalesDayType = "workday" | "holiday" | "shift";
export type WorkRoundingMinutes = 0 | 5 | 10 | 15 | 30;
export type RoundingMethod = "floor" | "ceil" | "nearest";
export type TimeEditRequestType = "missing_clock_in" | "missing_clock_out" | "wrong_time" | "break_fix" | "other";
export type TimeEditRequestStatus = "pending" | "approved" | "rejected";
export type TimeEditSource = "request" | "direct";

export type Company = {
  id: string;
  name: string;
  plan?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  billing_grace_period_started_at?: string | null;
  billing_grace_period_ends_at?: string | null;
  billing_email?: string | null;
  work_rounding_minutes: WorkRoundingMinutes;
  rounding_method: RoundingMethod;
  overtime_threshold_minutes: number;
  include_payroll: boolean;
  created_at: string;
};

export type CompanySettings = {
  work_rounding_minutes: WorkRoundingMinutes;
  rounding_method: RoundingMethod;
  overtime_threshold_minutes: number;
  include_payroll: boolean;
};

export type TenantRole = "owner" | "manager" | "staff" | "admin";
export type EmploymentType = "full_time" | "part_time" | "contract" | "other";

export type Profile = {
  id: string;
  user_id: string;
  company_id: string;
  store_id: string | null;
  name: string;
  email: string | null;
  employee_number: string | null;
  role: TenantRole;
  employment_type: EmploymentType | null;
  hourly_wage: number | null;
  fixed_salary: number | null;
  active: boolean;
  is_developer: boolean;
  terms_accepted_at: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
};

export type Attendance = {
  id: string;
  company_id: string;
  user_id: string;
  profile_id: string | null;
  store_id: string | null;
  work_type: SalesWorkType;
  break_minutes: number;
  day_type: SalesDayType;
  note: string | null;
  clock_in: string | null;
  clock_out: string | null;
  work_date: string;
  created_at: string;
  updated_at: string;
};

export type TimeEditRequest = {
  id: string;
  company_id: string;
  profile_id: string;
  attendance_id: string | null;
  target_date: string;
  request_type: TimeEditRequestType;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_break_minutes: number | null;
  reason: string;
  status: TimeEditRequestStatus;
  owner_comment: string | null;
  reviewed_by_profile_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeEditHistory = {
  id: string;
  company_id: string;
  attendance_id: string | null;
  profile_id: string;
  edited_by_profile_id: string;
  request_id: string | null;
  edit_type: string;
  before_clock_in: string | null;
  before_clock_out: string | null;
  before_break_minutes: number | null;
  before_work_type: SalesWorkType | null;
  after_clock_in: string | null;
  after_clock_out: string | null;
  after_break_minutes: number | null;
  after_work_type: SalesWorkType | null;
  reason: string;
  owner_comment: string | null;
  source: TimeEditSource;
  created_at: string;
};

export type AppNotification = {
  id: string;
  company_id: string;
  profile_id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  related_request_id: string | null;
  related_history_id: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  company_id: string;
  key: string;
  name: string;
  active: boolean;
  created_at: string;
};

export type AttendanceLog = {
  id: string;
  company_id: string;
  member_id: string;
  date: string;
  staff_id: string | null;
  staff_name: string | null;
  work_type: WorkType;
  break_flag: boolean;
  clock_in: string | null;
  clock_out: string | null;
  work_minutes: number | null;
  overtime_minutes: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  members?: Pick<Member, "name" | "key"> | null;
};

export type CalendarDay = {
  id: string;
  company_id: string;
  member_id: string;
  staff_id: string | null;
  date: string;
  day_type: CalendarDayType;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PdfEmailRecipient = {
  id: string;
  company_id: string;
  member_id: string;
  staff_id: string | null;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type GroupStaffConfig = {
  id: string;
  name: string;
};

export type GroupStaffStatus = GroupStaffConfig & {
  status: AttendanceStatus;
  clockIn: string | null;
  clockOut: string | null;
};

export type TimecardPayload = {
  member: Member;
  businessDate: string;
  status: AttendanceStatus;
  todayLog: AttendanceLog | null;
  recentLogs: AttendanceLog[];
  availableMonths: string[];
  now: string;
  groupStaff: GroupStaffConfig[] | null;
  staffStatuses: GroupStaffStatus[];
  selectedStaff: GroupStaffConfig | null;
};

