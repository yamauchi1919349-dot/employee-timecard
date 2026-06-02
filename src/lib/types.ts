export type WorkType = "normal" | "kitchen_car";
export type AttendanceStatus = "not_clocked_in" | "working" | "clocked_out";
export type CalendarDayType = "workday" | "holiday";

export type Company = {
  id: string;
  name: string;
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

