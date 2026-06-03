import { assertLegacyKeyAccessAllowed, createSupabaseAdmin } from "./supabase";
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
import { isReservedMemberKey } from "./reserved-routes";
import {
  AttendanceLog,
  CalendarDay,
  CalendarDayType,
  GroupStaffConfig,
  Member,
  PdfEmailRecipient,
  WorkType,
} from "./types";

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
  assertLegacyKeyAccessAllowed();

  if (isReservedMemberKey(key)) {
    throw new Error("このURLはシステム予約語のため、従業員キーとして使用できません。");
  }

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

function isMissingCalendarDaysTable(error: unknown) {
  const supabaseError = error as SupabaseErrorLike;
  return (
    supabaseError?.code === "42P01" &&
    typeof supabaseError.message === "string" &&
    supabaseError.message.includes("member_calendar_days")
  );
}

function isMissingTable(error: unknown, tableName: string) {
  const supabaseError = error as SupabaseErrorLike;
  return (
    supabaseError?.code === "42P01" &&
    typeof supabaseError.message === "string" &&
    supabaseError.message.includes(tableName)
  );
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
  breakFlag?: boolean;
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
  const nextBreakFlag =
    typeof params.breakFlag === "boolean" ? params.breakFlag : existing.break_flag;
  const workMinutes = calculateWorkMinutes(
    nextClockIn,
    nextClockOut,
    nextBreakFlag,
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
      break_flag: nextBreakFlag,
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
    if (isMissingAttendanceLogsTable(error)) return { member, logs: [], staff };
    throwWithContext(error, "attendance_logs monthly lookup failed");
  }
  return { member, logs: (data ?? []) as AttendanceLog[], staff };
}

export async function getCalendarDays(params: {
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
    .from("member_calendar_days")
    .select("*")
    .eq("member_id", member.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  query = applyStaffFilter(query, staff?.id ?? null);
  const { data, error } = await query;

  if (error) {
    if (isMissingCalendarDaysTable(error)) return { member, days: [] };
    throwWithContext(error, "member_calendar_days lookup failed");
  }

  return { member, days: (data ?? []) as CalendarDay[] };
}

export async function saveCalendarDay(params: {
  key: string;
  date: string;
  dayType: CalendarDayType;
  staffId?: string | null;
  note?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const staff = resolveStaff(params.key, params.staffId);
  let existingQuery = supabase
    .from("member_calendar_days")
    .select("*")
    .eq("member_id", member.id)
    .eq("date", params.date)
    .limit(1);

  existingQuery = applyStaffFilter(existingQuery, staff?.id ?? null);
  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle<CalendarDay>();

  if (existingError) {
    if (isMissingCalendarDaysTable(existingError)) {
      throw new Error("休日設定テーブルがありません。Supabaseでschema.sqlを実行してください。");
    }
    throwWithContext(existingError, "member_calendar_days lookup before write failed");
  }

  if (params.dayType === "workday") {
    if (!existing) return null;

    const { error } = await supabase
      .from("member_calendar_days")
      .delete()
      .eq("id", existing.id);

    if (error) throwWithContext(error, "member_calendar_days delete failed");
    return null;
  }

  const payload = {
    company_id: member.company_id,
    member_id: member.id,
    staff_id: staff?.id ?? null,
    date: params.date,
    day_type: params.dayType,
    note: params.note ?? null,
  };

  const query = existing
    ? supabase.from("member_calendar_days").update(payload).eq("id", existing.id)
    : supabase.from("member_calendar_days").insert(payload);

  const { data, error } = await query.select("*").single<CalendarDay>();
  if (error) throwWithContext(error, "member_calendar_days write failed");

  return data;
}

export async function getPdfEmailRecipients(params: {
  key: string;
  staffId?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const staff = resolveStaff(params.key, params.staffId);
  let query = supabase
    .from("pdf_email_recipients")
    .select("*")
    .eq("member_id", member.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  query = applyStaffFilter(query, staff?.id ?? null);
  const { data, error } = await query;

  if (error) {
    if (isMissingTable(error, "pdf_email_recipients")) return { member, recipients: [], staff };
    throwWithContext(error, "pdf_email_recipients lookup failed");
  }

  return {
    member,
    recipients: (data ?? []) as PdfEmailRecipient[],
    staff,
  };
}

export async function addPdfEmailRecipient(params: {
  key: string;
  email: string;
  staffId?: string | null;
}) {
  const email = normalizeEmail(params.email);
  if (!isValidEmail(email)) throw new Error("メールアドレスの形式が正しくありません。");

  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const staff = resolveStaff(params.key, params.staffId);
  let existingQuery = supabase
    .from("pdf_email_recipients")
    .select("*")
    .eq("member_id", member.id)
    .eq("email", email)
    .limit(1);

  existingQuery = applyStaffFilter(existingQuery, staff?.id ?? null);
  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle<PdfEmailRecipient>();

  if (existingError) {
    if (isMissingTable(existingError, "pdf_email_recipients")) {
      throw new Error("PDF送信先テーブルがありません。Supabaseでschema.sqlを実行してください。");
    }
    throwWithContext(existingError, "pdf_email_recipients lookup before write failed");
  }

  const payload = {
    company_id: member.company_id,
    member_id: member.id,
    staff_id: staff?.id ?? null,
    email,
    active: true,
  };
  const query = existing
    ? supabase.from("pdf_email_recipients").update(payload).eq("id", existing.id)
    : supabase.from("pdf_email_recipients").insert(payload);

  const { data, error } = await query.select("*").single<PdfEmailRecipient>();
  if (error) throwWithContext(error, "pdf_email_recipients write failed");

  return data;
}

export async function deletePdfEmailRecipient(params: {
  key: string;
  id: string;
  staffId?: string | null;
}) {
  const supabase = createSupabaseAdmin();
  const member = await getMemberByKey(supabase, params.key);

  if (!member) throw new Error("従業員が見つかりません。");

  const staff = resolveStaff(params.key, params.staffId);
  let query = supabase
    .from("pdf_email_recipients")
    .update({ active: false })
    .eq("id", params.id)
    .eq("member_id", member.id);

  query = applyStaffFilter(query, staff?.id ?? null);
  const { error } = await query;

  if (error) throwWithContext(error, "pdf_email_recipients delete failed");
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

function applyStaffFilter<
  T extends {
    is: (column: string, value: null) => T;
    eq: (column: string, value: string) => T;
  },
>(
  query: T,
  staffId?: string | null,
) {
  return staffId ? query.eq("staff_id", staffId) : query.is("staff_id", null);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
