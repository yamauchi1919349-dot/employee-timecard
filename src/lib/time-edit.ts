import { SalesWorkType, TimeEditRequestStatus, TimeEditRequestType } from "./types";

export const TIME_EDIT_REQUEST_TYPES: TimeEditRequestType[] = [
  "missing_clock_in",
  "missing_clock_out",
  "wrong_time",
  "break_fix",
  "other",
];

export const TIME_EDIT_STATUSES: TimeEditRequestStatus[] = ["pending", "approved", "rejected"];
export const SALES_WORK_TYPES: SalesWorkType[] = ["normal", "paid_leave", "half_day", "other"];

export function normalizeRole(role?: string | null) {
  return role?.trim().toLowerCase() ?? "";
}

export function getRequestTypeLabel(type: string) {
  const labels: Record<string, string> = {
    missing_clock_in: "出勤忘れ",
    missing_clock_out: "退勤忘れ",
    wrong_time: "時刻間違い",
    break_fix: "休憩時間修正",
    other: "その他",
  };
  return labels[type] ?? type;
}

export function getRequestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "申請中",
    approved: "承認",
    rejected: "却下",
  };
  return labels[status] ?? status;
}

export function getWorkTypeLabel(type: string) {
  const labels: Record<string, string> = {
    normal: "通常勤務",
    paid_leave: "有給",
    half_day: "半休",
    other: "その他",
  };
  return labels[type] ?? type;
}

export function parseDateTimeLocal(date: string, time?: string | null) {
  if (!time) return null;
  const match = `${date}T${time}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("時刻の形式が正しくありません。");
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
}

export function toDateTimeLocalValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}
