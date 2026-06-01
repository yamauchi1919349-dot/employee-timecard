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
import { AttendanceLog, Member, WorkType } from "./types";

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
) {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", memberId)
    .eq("date", businessDate)
    .limit(1)
    .maybeSingle<AttendanceLog>();

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
) {
  const dates = getPastBusinessDateKeys(businessDate, 3);
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", memberId)
    .in("date", dates)
    .order("date", { ascending: false });

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return [];
    throwWithContext(error, "attendance_logs recent lookup failed");
  }
  return (data ?? []) as AttendanceLog[];
}

export async function getAvailableMonths(supabase: Supabase, memberId: string) {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("date")
    .eq("member_id", memberId)
    .order("date", { ascending: false });

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return [];
    throwWithContext(error, "attendance_logs months lookup failed");
  }

  return Array.from(
    new Set((data ?? []).map((log) => String(log.date).slice(0, 7))),
  );
}

export async function getTimecardData(key: string) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, key);

  if (!member) {
    return null;
  }

  const businessDate = getBusinessDate();
  const [todayLog, recentLogs, availableMonths] = await Promise.all([
    getTodayLog(supabase, member.id, businessDate),
    getRecentLogs(supabase, member.id, businessDate),
    getAvailableMonths(supabase, member.id),
  ]);

  return {
    member,
    businessDate,
    status: getStatus(todayLog),
    todayLog,
    recentLogs,
    availableMonths,
    now: new Date().toISOString(),
  };
}

export async function clockIn(params: {
  key: string;
  workType: WorkType;
  breakFlag: boolean;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const businessDate = getBusinessDate();
  const existing = await getTodayLog(supabase, member.id, businessDate);

  if (existing?.clock_in) {
    throw new Error("本日はすでに出勤済みです。");
  }

  const now = new Date().toISOString();
  const payload = {
    company_id: member.company_id,
    member_id: member.id,
    date: businessDate,
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
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const businessDate = getBusinessDate();
  const existing = await getTodayLog(supabase, member.id, businessDate);

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

export async function getMonthlyLogs(params: { key: string; month: string }) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const start = `${params.month}-01`;
  const [year, month] = params.month.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("member_id", member.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  if (error) {
    if (isMissingAttendanceLogsTable(error)) return { member, logs: [] };
    throwWithContext(error, "attendance_logs monthly lookup failed");
  }
  return { member, logs: (data ?? []) as AttendanceLog[] };
}
