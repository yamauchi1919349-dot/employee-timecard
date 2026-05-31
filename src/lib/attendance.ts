import { AttendanceLog, AttendanceStatus, Member, WorkType } from "./types";

export const BASIC_WORK_MINUTES = 480;
export const BREAK_MINUTES = 60;
export const BUSINESS_DAY_SWITCH_HOUR = 5;
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Tokyo";

const workTypeLabels: Record<WorkType, string> = {
  normal: "通常勤務",
  kitchen_car: "キッチンカー",
};

export function getWorkTypeLabel(workType: WorkType) {
  return workTypeLabels[workType] ?? workType;
}

export function getStatus(log: AttendanceLog | null): AttendanceStatus {
  if (!log?.clock_in) return "not_clocked_in";
  if (!log.clock_out) return "working";
  return "clocked_out";
}

export function getStatusLabel(status: AttendanceStatus) {
  const labels: Record<AttendanceStatus, string> = {
    not_clocked_in: "未出勤",
    working: "出勤中",
    clocked_out: "退勤済み",
  };

  return labels[status];
}

export function formatLocalDateTime(iso: string | null) {
  if (!iso) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatTime(iso: string | null) {
  if (!iso) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "0:00";

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${rest.toString().padStart(2, "0")}`;
}

export function getLocalDateKey(date = new Date()) {
  const parts = getZonedParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getBusinessDate(date = new Date()) {
  const parts = getZonedParts(date);
  const baseUtc = Date.UTC(parts.year, parts.month - 1, parts.day);

  if (parts.hour < BUSINESS_DAY_SWITCH_HOUR) {
    return dateKeyFromUtcMidnight(new Date(baseUtc - 24 * 60 * 60 * 1000));
  }

  return dateKeyFromUtcMidnight(new Date(baseUtc));
}

export function getPastBusinessDateKeys(baseDate: string, days: number) {
  const [year, month, day] = baseDate.split("-").map(Number);
  const baseUtc = Date.UTC(year, month - 1, day);

  return Array.from({ length: days }, (_, index) =>
    dateKeyFromUtcMidnight(new Date(baseUtc - index * 24 * 60 * 60 * 1000)),
  );
}

export function calculateWorkMinutes(
  clockInIso: string,
  clockOutIso: string,
  breakFlag: boolean,
) {
  const rawMinutes = Math.floor(
    (new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()) / 60000,
  );
  return Math.max(0, rawMinutes - (breakFlag ? BREAK_MINUTES : 0));
}

export function calculateOvertimeMinutes(workMinutes: number) {
  return Math.max(0, workMinutes - BASIC_WORK_MINUTES);
}

export function calculatePdfMinutes(
  clockInIso: string | null,
  clockOutIso: string | null,
  breakFlag: boolean,
) {
  if (!clockInIso || !clockOutIso) {
    return { workMinutes: 0, overtimeMinutes: 0 };
  }

  const roundedIn = ceilToMinutes(new Date(clockInIso), 15);
  const roundedOut = floorToMinutes(new Date(clockOutIso), 15);
  const workMinutes = calculateWorkMinutes(
    roundedIn.toISOString(),
    roundedOut.toISOString(),
    breakFlag,
  );

  return {
    workMinutes,
    overtimeMinutes: calculateOvertimeMinutes(workMinutes),
  };
}

export function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";

  const parts = getZonedParts(new Date(iso));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(
    parts.hour,
  )}:${pad2(parts.minute)}`;
}

export function parseJapaneseDatetimeLocal(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/,
  );

  if (!match) {
    throw new Error("日時の形式が正しくありません。");
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  const utc = Date.UTC(year, month - 1, day, hour - 9, minute);
  return new Date(utc).toISOString();
}

export function buildRevisionNote(
  previousClockIn: string | null,
  previousClockOut: string | null,
  nextClockIn: string,
  nextClockOut: string,
) {
  const revisions: string[] = [];

  if (previousClockIn && !isSameMinute(previousClockIn, nextClockIn)) {
    revisions.push(
      `出勤 ${formatTime(previousClockIn)} -> ${formatTime(nextClockIn)}`,
    );
  }

  if (previousClockOut && !isSameMinute(previousClockOut, nextClockOut)) {
    revisions.push(
      `退勤 ${formatTime(previousClockOut)} -> ${formatTime(nextClockOut)}`,
    );
  }

  if (revisions.length === 0) return "";
  return `退勤時修正あり（${revisions.join("、")}）`;
}

export function appendNote(currentNote: string | null, addition: string) {
  if (!addition) return currentNote;
  return currentNote ? `${currentNote}\n${addition}` : addition;
}

export function summarizeMonthlyLogs(logs: AttendanceLog[]) {
  return logs.reduce(
    (summary, log) => {
      const pdfMinutes = calculatePdfMinutes(
        log.clock_in,
        log.clock_out,
        log.break_flag,
      );

      summary.totalWorkMinutes += pdfMinutes.workMinutes;
      summary.workedDays += log.clock_in && log.clock_out ? 1 : 0;

      if (log.work_type === "kitchen_car") {
        summary.kitchenCarOvertimeMinutes += pdfMinutes.overtimeMinutes;
      } else {
        summary.normalOvertimeMinutes += pdfMinutes.overtimeMinutes;
      }

      return summary;
    },
    {
      totalWorkMinutes: 0,
      normalOvertimeMinutes: 0,
      kitchenCarOvertimeMinutes: 0,
      workedDays: 0,
    },
  );
}

export function memberDisplayName(member: Member | null) {
  return member?.name ?? "未登録メンバー";
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

function dateKeyFromUtcMidnight(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function ceilToMinutes(date: Date, interval: number) {
  const ms = interval * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function floorToMinutes(date: Date, interval: number) {
  const ms = interval * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function isSameMinute(leftIso: string, rightIso: string) {
  return Math.floor(new Date(leftIso).getTime() / 60000) === Math.floor(new Date(rightIso).getTime() / 60000);
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}
