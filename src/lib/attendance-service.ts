import { createSupabaseAdmin } from "./supabase";
import {
  appendNote,
  buildRevisionNote,
  calculateOvertimeMinutes,
  calculateWorkMinutes,
  getBusinessDate,
  getPastBusinessDateKeys,
  getStatus,
  parseJapaneseDatetimeLocal,
} from "./attendance";
import { getGroupStaffConfig, getGroupStaffConfigs } from "./group-staff";
import { AttendanceLog, GroupStaffConfig, Member, WorkType } from "./types";

type Supabase = ReturnType<typeof createSupabaseAdmin>;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function isMissingAttendanceLogsTable(error: unknown) {
  const supabaseError = error as SupabaseErrorLike;
  return (
    supabaseError?.code === "42P01" &&
    typeof supabaseError.message === "string" &&
    supabaseError.message.includes("attendance_logs")
  );
}

function throwWithContext(error: unknown, context: string): never {
  const supabaseError = error as SupabaseErrorLike;
  const message =
    error instanceof Error
      ? error.message
      : supabaseError?.message ?? "Unknown Supabase error";
  const code = supabaseError?.code ? ` (${supabaseError.code})` : "";

  throw new Error(`${context}${code}: ${message}`);
}

export async function getMemberByKey(supabase: Supabase, key: string) {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("key", key)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Member>();

  if (error) throwWithContext(error, "members table lookup failed");
  return data;
}

export async function getTodayLog(
  supabase: Supabase,
  memberId: string,
  businessDate = getBusinessDate(),
  staffId?: string | null,
) {
  let query = supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", memberId)
    .eq("date", businessDate)
    .limit(1);

  query = applyStaffFilter(query, staffId);
  const { data, error } = await query.maybeSingle<AttendanceLog>();

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return null;
    throwWithContext(error, "attendance_logs today lookup failed");
  }
  return data;
}

export async function getRecentLogs(
  supabase: Supabase,
  memberId: string,
  businessDate = getBusinessDate(),
  staffId?: string | null,
) {
  const dates = getPastBusinessDateKeys(businessDate, 3);
  let query = supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", memberId)
    .in("date", dates)
    .order("date", { ascending: false });

  query = applyStaffFilter(query, staffId);
  const { data, error } = await query;

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return [];
    throwWithContext(error, "attendance_logs recent lookup failed");
  }
  return (data ?? []) as AttendanceLog[];
}

export async function getAvailableMonths(
  supabase: Supabase,
  memberId: string,
  staffId?: string | null,
) {
  let query = supabase
    .from("attendance_logs")
    .select("date")
    .eq("member_id", memberId)
    .order("date", { ascending: false });

  query = applyStaffFilter(query, staffId);
  const { data, error } = await query;

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return [];
    throwWithContext(error, "attendance_logs months lookup failed");
  }

  return Array.from(
    new Set((data ?? []).map((log) => String(log.date).slice(0, 7))),
  );
}

export async function getTimecardData(
  key: string,
  options: { staffId?: string | null } = {},
) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, key);

  if (!member) {
    return null;
  }

  const businessDate = getBusinessDate();
  const groupStaff = getGroupStaffConfigs(key);
  const selectedStaff = groupStaff
    ? getGroupStaffConfig(key, options.staffId)
    : null;
  const staffId = groupStaff ? selectedStaff?.id ?? null : null;
  const [todayLog, recentLogs, availableMonths, staffStatuses] = await Promise.all([
    getTodayLog(supabase, member.id, businessDate, staffId),
    getRecentLogs(supabase, member.id, businessDate, staffId),
    getAvailableMonths(supabase, member.id, staffId),
    groupStaff ? getStaffStatuses(supabase, member.id, businessDate, groupStaff) : [],
  ]);

  return {
    member,
    businessDate,
    status: getStatus(todayLog),
    todayLog,
    recentLogs,
    availableMonths,
    now: new Date().toISOString(),
    groupStaff,
    staffStatuses,
    selectedStaff,
  };
}

export async function clockIn(params: {
  key: string;
  workType: WorkType;
  breakFlag: boolean;
  staffId?: string | null;
  staffName?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const businessDate = getBusinessDate();
  const staff = resolveStaff(params.key, params.staffId, params.staffName);
  const existing = await getTodayLog(supabase, member.id, businessDate, staff?.id ?? null);

  if (existing?.clock_in) {
    throw new Error("本日はすでに出勤済みです。");
  }

  const now = new Date().toISOString();
  const payload = {
    company_id: member.company_id,
    member_id: member.id,
    date: businessDate,
    staff_id: staff?.id ?? null,
    staff_name: staff?.name ?? null,
    work_type: params.workType,
    break_flag: params.breakFlag,
    clock_in: now,
    clock_out: null,
    work_minutes: null,
    overtime_minutes: null,
    note: null,
  };

  const query = existing
    ? supabase.from("attendance_logs").update(payload).eq("id", existing.id)
    : supabase.from("attendance_logs").insert(payload);

  const { data, error } = await query.select("*").single<AttendanceLog>();
  if (error) throwWithContext(error, "attendance_logs clock-in write failed");

  return data;
}

export async function clockOut(params: {
  key: string;
  clockIn?: string;
  clockOut?: string;
  staffId?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const businessDate = getBusinessDate();
  const staff = resolveStaff(params.key, params.staffId);
  const existing = await getTodayLog(supabase, member.id, businessDate, staff?.id ?? null);

  if (!existing?.clock_in) {
    throw new Error("出勤前に退勤はできません。");
  }

  if (existing.clock_out) {
    throw new Error("本日はすでに退勤済みです。");
  }

  const nextClockIn = params.clockIn
    ? parseJapaneseDatetimeLocal(params.clockIn)
    : existing.clock_in;
  const actualClockOut = new Date().toISOString();
  const nextClockOut = params.clockOut
    ? parseJapaneseDatetimeLocal(params.clockOut)
    : actualClockOut;
  const workMinutes = calculateWorkMinutes(
    nextClockIn,
    nextClockOut,
    existing.break_flag,
  );
  const revisionNote = buildRevisionNote(
    existing.clock_in,
    actualClockOut,
    nextClockIn,
    nextClockOut,
  );

  const { data, error } = await supabase
    .from("attendance_logs")
    .update({
      clock_in: nextClockIn,
      clock_out: nextClockOut,
      work_minutes: workMinutes,
      overtime_minutes: calculateOvertimeMinutes(workMinutes),
      note: appendNote(existing.note, revisionNote),
    })
    .eq("id", existing.id)
    .select("*")
    .single<AttendanceLog>();

  if (error) throwWithContext(error, "attendance_logs clock-out write failed");
  return data;
}

export async function getMonthlyLogs(params: {
  key: string;
  month: string;
  staffId?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const start = `${params.month}-01`;
  const [year, month] = params.month.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const staff = resolveStaff(params.key, params.staffId);
  let query = supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", member.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  query = applyStaffFilter(query, staff?.id ?? null);
  const { data, error } = await query;

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return { member, logs: [] };
    throwWithContext(error, "attendance_logs monthly lookup failed");
  }
  return { member, logs: (data ?? []) as AttendanceLog[] };
}

async function getStaffStatuses(
  supabase: Supabase,
  memberId: string,
  businessDate: string,
  staffConfigs: GroupStaffConfig[],
) {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", memberId)
    .eq("date", businessDate)
    .in(
      "staff_id",
      staffConfigs.map((staff) => staff.id),
    );

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return [];
    throwWithContext(error, "attendance_logs staff status lookup failed");
  }

  const logs = ((data ?? []) as AttendanceLog[]).reduce<Record<string, AttendanceLog>>(
    (index, log) => {
      if (log.staff_id) index[log.staff_id] = log;
      return index;
    },
    {},
  );

  return staffConfigs.map((staff) => {
    const log = logs[staff.id] ?? null;
    return {
      ...staff,
      status: getStatus(log),
      clockIn: log?.clock_in ?? null,
      clockOut: log?.clock_out ?? null,
    };
  });
}

function resolveStaff(
  key: string,
  staffId?: string | null,
  staffName?: string | null,
) {
  const groupStaff = getGroupStaffConfigs(key);
  if (!groupStaff) return null;

  const staff = getGroupStaffConfig(key, staffId);
  if (!staff) {
    throw new Error("スタッフを選択してください。");
  }

  return {
    id: staff.id,
    name: staffName || staff.name,
  };
}

function applyStaffFilter<T extends { is: Function; eq: Function }>(
  query: T,
  staffId?: string | null,
) {
  return staffId ? query.eq("staff_id", staffId) : query.is("staff_id", null);
}
