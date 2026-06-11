import type { CompanySettings } from "@/lib/types";

export type MonthlyCsvPayload = {
  selectedMonth: string;
  selectedProfileId: string | null;
  summary: {
    workedDays: number;
    holidayDays: number;
    totalWorkMinutes: number;
    overtimeMinutes: number;
    estimatedPayrollTotal: number | null;
  };
  settings: CompanySettings;
  rows: MonthlyCsvRow[];
};

export type MonthlyCsvRow = {
  id: string;
  profileId: string | null;
  userId: string;
  staffName: string;
  staffEmail: string | null;
  employeeNumber: string | null;
  hourlyWage: number | null;
  fixedSalary: number | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  workType: string;
  breakMinutes: number;
  roundedWorkMinutes: number;
  overtimeMinutes: number;
  payrollSource: "hourly" | "fixed" | "none";
  estimatedPayroll: number | null;
};

export function buildGenericMonthlyCsv(payload: MonthlyCsvPayload) {
  const includePayroll = payload.settings.include_payroll;
  const summaryHeaders = [
    "対象月",
    "スタッフ名",
    "勤務日数",
    "総労働時間",
    "残業時間",
    ...(includePayroll ? ["給与目安"] : []),
  ];
  const summaryRows = buildStaffSummaryRows(payload.rows, payload.selectedMonth, includePayroll);
  const detailHeaders = [
    "対象月",
    "スタッフ名",
    "日付",
    "出勤時刻",
    "退勤時刻",
    "休憩時間",
    "労働時間",
    "残業時間",
    "勤務区分",
    ...(includePayroll ? ["給与目安"] : []),
  ];
  const detailRows = payload.rows.map((row) => [
    payload.selectedMonth,
    row.staffName,
    row.workDate,
    formatTime(row.clockIn),
    row.clockOut ? formatTime(row.clockOut) : "退勤未打刻",
    formatMinutes(row.breakMinutes),
    row.clockOut ? formatMinutes(row.roundedWorkMinutes) : "未確定",
    row.clockOut ? formatMinutes(row.overtimeMinutes) : "未確定",
    getWorkTypeLabel(row.workType),
    ...(includePayroll ? [getPayrollLabel(row)] : []),
  ]);
  const csvRows = [
    ["スタッフ別集計"],
    summaryHeaders,
    ...summaryRows,
    [],
    ["勤怠明細"],
    detailHeaders,
    ...detailRows,
  ];
  const csv = csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${csv}`;
}

export function buildPayrollImportCsv(payload: MonthlyCsvPayload) {
  const headers = [
    "対象月",
    "社員番号",
    "スタッフ名",
    "メールアドレス",
    "勤務日数",
    "総労働時間",
    "残業時間",
    "休憩時間合計",
    "勤務区分",
    "備考",
  ];
  const rows = buildPayrollImportRows(payload.rows, payload.selectedMonth);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${csv}`;
}

function buildPayrollImportRows(rows: MonthlyCsvRow[], month: string) {
  const summaries = new Map<
    string,
    {
      employeeNumber: string | null;
      staffName: string;
      staffEmail: string | null;
      workedDays: number;
      totalWorkMinutes: number;
      overtimeMinutes: number;
      breakMinutes: number;
      workTypes: Set<string>;
      hasUnclosedRows: boolean;
    }
  >();

  rows.forEach((row) => {
    const key = row.profileId ?? row.userId;
    const summary =
      summaries.get(key) ??
      {
        employeeNumber: row.employeeNumber,
        staffName: row.staffName,
        staffEmail: row.staffEmail,
        workedDays: 0,
        totalWorkMinutes: 0,
        overtimeMinutes: 0,
        breakMinutes: 0,
        workTypes: new Set<string>(),
        hasUnclosedRows: false,
      };

    summary.employeeNumber = summary.employeeNumber ?? row.employeeNumber;
    summary.staffEmail = summary.staffEmail ?? row.staffEmail;
    summary.workedDays += 1;
    summary.workTypes.add(getWorkTypeLabel(row.workType));
    summary.breakMinutes += row.breakMinutes;

    if (row.clockOut) {
      summary.totalWorkMinutes += row.roundedWorkMinutes;
      summary.overtimeMinutes += row.overtimeMinutes;
    } else {
      summary.hasUnclosedRows = true;
    }

    summaries.set(key, summary);
  });

  return Array.from(summaries.values()).map((summary) => [
    month,
    summary.employeeNumber ?? "",
    summary.staffName,
    summary.staffEmail ?? "",
    `${summary.workedDays}日`,
    formatMinutes(summary.totalWorkMinutes),
    formatMinutes(summary.overtimeMinutes),
    formatMinutes(summary.breakMinutes),
    Array.from(summary.workTypes).join(" / "),
    summary.hasUnclosedRows ? "未退勤行あり" : "",
  ]);
}

function buildStaffSummaryRows(rows: MonthlyCsvRow[], month: string, includePayroll: boolean) {
  const summaries = new Map<
    string,
    {
      staffName: string;
      workedDays: number;
      totalWorkMinutes: number;
      overtimeMinutes: number;
      payrollTotal: number;
      fixedSalaryAdded: boolean;
    }
  >();

  rows.forEach((row) => {
    const key = row.profileId ?? row.userId;
    const summary =
      summaries.get(key) ??
      {
        staffName: row.staffName,
        workedDays: 0,
        totalWorkMinutes: 0,
        overtimeMinutes: 0,
        payrollTotal: 0,
        fixedSalaryAdded: false,
      };

    summary.workedDays += 1;

    if (row.clockOut) {
      summary.totalWorkMinutes += row.roundedWorkMinutes;
      summary.overtimeMinutes += row.overtimeMinutes;
    }

    if (includePayroll) {
      if (row.payrollSource === "fixed" && row.fixedSalary && !summary.fixedSalaryAdded) {
        summary.payrollTotal += row.fixedSalary;
        summary.fixedSalaryAdded = true;
      } else if (row.payrollSource === "hourly" && row.clockOut && row.estimatedPayroll) {
        summary.payrollTotal += row.estimatedPayroll;
      }
    }

    summaries.set(key, summary);
  });

  return Array.from(summaries.values()).map((summary) => [
    month,
    summary.staffName,
    `${summary.workedDays}日`,
    formatMinutes(summary.totalWorkMinutes),
    formatMinutes(summary.overtimeMinutes),
    ...(includePayroll ? [formatCurrency(summary.payrollTotal)] : []),
  ]);
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (!minutes || minutes <= 0) return "0時間00分";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}時間${String(rest).padStart(2, "0")}分`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPayrollLabel(row: MonthlyCsvRow) {
  if (row.payrollSource === "fixed") return row.fixedSalary ? `固定給 ${formatCurrency(row.fixedSalary)}` : "固定給";
  if (row.payrollSource === "hourly") return row.estimatedPayroll !== null ? formatCurrency(row.estimatedPayroll) : "未確定";
  return "未設定";
}

function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function getWorkTypeLabel(workType: string) {
  const labels: Record<string, string> = {
    normal: "通常出勤",
    holiday_work: "休日出勤",
    late: "遅刻",
    early_leave: "早退",
    half_day: "半休",
    other: "その他",
    paid_leave: "有給（旧区分）",
  };
  return labels[workType] ?? workType;
}
