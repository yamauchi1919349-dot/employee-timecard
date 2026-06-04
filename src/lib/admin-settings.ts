import { CompanySettings, RoundingMethod, WorkRoundingMinutes } from "./types";

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  work_rounding_minutes: 15,
  rounding_method: "nearest",
  overtime_threshold_minutes: 480,
  include_payroll: false,
};

export const WORK_ROUNDING_OPTIONS: WorkRoundingMinutes[] = [0, 5, 10, 15, 30];
export const ROUNDING_METHODS: RoundingMethod[] = ["floor", "ceil", "nearest"];

export function normalizeCompanySettings(value: Partial<CompanySettings> | null | undefined): CompanySettings {
  return {
    work_rounding_minutes: isWorkRoundingMinutes(value?.work_rounding_minutes)
      ? value.work_rounding_minutes
      : DEFAULT_COMPANY_SETTINGS.work_rounding_minutes,
    rounding_method: isRoundingMethod(value?.rounding_method)
      ? value.rounding_method
      : DEFAULT_COMPANY_SETTINGS.rounding_method,
    overtime_threshold_minutes: isValidOvertimeThreshold(value?.overtime_threshold_minutes)
      ? value.overtime_threshold_minutes
      : DEFAULT_COMPANY_SETTINGS.overtime_threshold_minutes,
    include_payroll: value?.include_payroll === true,
  };
}

export function isWorkRoundingMinutes(value: unknown): value is WorkRoundingMinutes {
  return typeof value === "number" && WORK_ROUNDING_OPTIONS.includes(value as WorkRoundingMinutes);
}

export function isRoundingMethod(value: unknown): value is RoundingMethod {
  return typeof value === "string" && ROUNDING_METHODS.includes(value as RoundingMethod);
}

export function isValidOvertimeThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 60 && value <= 1440;
}

export function roundDateToInterval(date: Date, intervalMinutes: WorkRoundingMinutes, method: RoundingMethod) {
  if (intervalMinutes === 0) return date;

  const intervalMs = intervalMinutes * 60 * 1000;
  const time = date.getTime() / intervalMs;

  if (method === "floor") return new Date(Math.floor(time) * intervalMs);
  if (method === "ceil") return new Date(Math.ceil(time) * intervalMs);
  return new Date(Math.round(time) * intervalMs);
}
