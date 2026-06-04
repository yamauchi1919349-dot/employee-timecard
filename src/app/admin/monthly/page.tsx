"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { CompanySettings, Profile, RoundingMethod, WorkRoundingMinutes } from "@/lib/types";

type MonthlyPayload = {
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
  rows: MonthlyRow[];
};

type MonthlyRow = {
  id: string;
  profileId: string | null;
  userId: string;
  staffName: string;
  staffEmail: string | null;
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

export default function AdminMonthlyPage() {
  return (
    <RequireAuth>
      <AdminMonthlyContent />
    </RequireAuth>
  );
}

function AdminMonthlyContent() {
  const { session, profile } = useAuth();
  const role = profile?.role?.trim().toLowerCase() ?? "";
  const canView = ["owner", "manager", "admin"].includes(role);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [month, setMonth] = useState(() => getCurrentMonth());
  const [profileId, setProfileId] = useState("");
  const [payload, setPayload] = useState<MonthlyPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedStaffLabel = useMemo(() => {
    if (!profileId) return "全スタッフ";
    return staff.find((row) => row.id === profileId)?.name ?? "選択中スタッフ";
  }, [profileId, staff]);

  function handleCsvDownload() {
    if (!payload) return;

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
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monthly-attendance-${payload.selectedMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!session || !canView) return;

    async function loadStaff() {
      const response = await fetch("/api/admin/staff", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setStaff(data.staff ?? []);
      }
    }

    void loadStaff();
  }, [canView, session]);

  useEffect(() => {
    if (!session || !canView) return;

    async function loadMonthly() {
      setLoading(true);
      setMessage(null);
      const params = new URLSearchParams({ month });
      if (profileId) params.set("profileId", profileId);

      const response = await fetch(`/api/admin/monthly?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setPayload(null);
        setMessage(data.message ?? "月次集計の取得に失敗しました。");
        return;
      }

      setPayload(data);
    }

    void loadMonthly();
  }, [canView, month, profileId, session]);

  if (!canView) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold">月次集計を表示できません</h1>
          <p className="mt-3 text-sm text-slate-500">管理者権限でログインしてください。</p>
          <Link href="/dashboard" className="mt-5 inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white">
            ダッシュボードへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main data-route="sales-admin-monthly" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-bold text-blue-700">管理者</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">月次集計</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              打刻履歴のみを基準に集計します。カレンダー休日設定は反映しません。
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            ダッシュボードへ戻る
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="text-sm font-semibold text-slate-700">
              月選択
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              スタッフ選択
              <select
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              >
                <option value="">全スタッフ</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} / {row.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleCsvDownload}
              disabled={!payload || loading}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
            >
              CSV出力
            </button>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
            {message}
          </div>
        ) : null}

        <section className={`grid gap-4 sm:grid-cols-2 ${payload?.settings.include_payroll ? "xl:grid-cols-5" : "lg:grid-cols-4"}`}>
          <SummaryCard label="出勤日数" value={`${payload?.summary.workedDays ?? 0}日`} />
          <SummaryCard label="休日" value={`${payload?.summary.holidayDays ?? 0}日`} />
          <SummaryCard label="総労働時間" value={formatMinutes(payload?.summary.totalWorkMinutes ?? 0)} />
          <SummaryCard label="残業時間" value={formatMinutes(payload?.summary.overtimeMinutes ?? 0)} />
          {payload?.settings.include_payroll ? (
            <SummaryCard label="給与目安" value={formatCurrency(payload.summary.estimatedPayrollTotal ?? 0)} />
          ) : null}
        </section>

        {payload?.settings ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black">反映中の管理設定</h2>
                <p className="mt-1 text-sm text-slate-500">
                  集計値のみ設定を反映します。出勤・退勤時刻は実打刻のままです。
                </p>
              </div>
              <Link
                href="/admin/settings"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                管理設定
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SettingChip label="計算ルール" value={getRoundingRuleLabel(payload.settings.work_rounding_minutes)} />
              <SettingChip label="丸め方式" value={getRoundingMethodLabel(payload.settings.rounding_method)} />
              <SettingChip label="残業開始" value={`${formatHours(payload.settings.overtime_threshold_minutes)}超`} />
              <SettingChip label="給与計算" value={payload.settings.include_payroll ? "含める" : "含めない"} />
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">打刻記録一覧</h2>
              <p className="mt-1 text-sm text-slate-500">
                {month} / {selectedStaffLabel}
              </p>
            </div>
            {loading ? <p className="text-sm font-semibold text-slate-500">読み込み中...</p> : null}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-100 md:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">日付</th>
                  <th className="px-4 py-3">スタッフ</th>
                  <th className="px-4 py-3">勤務区分</th>
                  <th className="px-4 py-3">出勤</th>
                  <th className="px-4 py-3">退勤</th>
                  <th className="px-4 py-3">休憩</th>
                  <th className="px-4 py-3">労働時間</th>
                  <th className="px-4 py-3">残業</th>
                  {payload?.settings.include_payroll ? <th className="px-4 py-3">給与目安</th> : null}
                </tr>
              </thead>
              <tbody>
                {(payload?.rows ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{formatDate(row.workDate)}</td>
                    <td className="px-4 py-3">{row.staffName}</td>
                    <td className="px-4 py-3">{getWorkTypeLabel(row.workType)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(row.clockIn)}</td>
                    <td className="px-4 py-3">{row.clockOut ? formatTime(row.clockOut) : <span className="font-bold text-rose-600">退勤未打刻</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMinutes(row.breakMinutes)}</td>
                    <td className="px-4 py-3 font-semibold">{row.clockOut ? formatMinutes(row.roundedWorkMinutes) : "未確定"}</td>
                    <td className="px-4 py-3 font-semibold">{row.clockOut ? formatMinutes(row.overtimeMinutes) : "未確定"}</td>
                    {payload?.settings.include_payroll ? (
                      <td className="px-4 py-3">{getPayrollLabel(row)}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {(payload?.rows ?? []).map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{formatDate(row.workDate)}</p>
                    <h3 className="mt-1 text-lg font-bold">{row.staffName}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-600">
                    {getWorkTypeLabel(row.workType)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <RecordMetric label="出勤" value={formatTime(row.clockIn)} />
                  <RecordMetric
                    label="退勤"
                    value={row.clockOut ? formatTime(row.clockOut) : "退勤未打刻"}
                    attention={!row.clockOut}
                  />
                  <RecordMetric label="休憩" value={formatMinutes(row.breakMinutes)} />
                  <RecordMetric
                    label="労働時間"
                    value={row.clockOut ? formatMinutes(row.roundedWorkMinutes) : "未確定"}
                  />
                  <RecordMetric
                    label="残業"
                    value={row.clockOut ? formatMinutes(row.overtimeMinutes) : "未確定"}
                  />
                  {payload?.settings.include_payroll ? (
                    <RecordMetric label="給与目安" value={getPayrollLabel(row)} />
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!loading && (payload?.rows ?? []).length === 0 ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              この月の打刻記録はありません。
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 lg:text-3xl">{value}</p>
    </div>
  );
}

function SettingChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function RecordMetric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 font-bold ${attention ? "text-rose-600" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00+09:00`));
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

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}時間` : `${hours.toFixed(1)}時間`;
}

function getRoundingRuleLabel(value: WorkRoundingMinutes) {
  const labels: Record<WorkRoundingMinutes, string> = {
    0: "打刻通り",
    5: "5分丸め",
    10: "10分丸め",
    15: "15分丸め",
    30: "30分丸め",
  };
  return labels[value];
}

function getRoundingMethodLabel(value: RoundingMethod) {
  const labels: Record<RoundingMethod, string> = {
    floor: "切り捨て",
    ceil: "切り上げ",
    nearest: "四捨五入",
  };
  return labels[value];
}

function getPayrollLabel(row: MonthlyRow) {
  if (row.payrollSource === "fixed") return row.fixedSalary ? `固定給 ${formatCurrency(row.fixedSalary)}` : "固定給";
  if (row.payrollSource === "hourly") return row.estimatedPayroll !== null ? formatCurrency(row.estimatedPayroll) : "未確定";
  return "未設定";
}

function buildStaffSummaryRows(rows: MonthlyRow[], month: string, includePayroll: boolean) {
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

function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function getWorkTypeLabel(workType: string) {
  const labels: Record<string, string> = {
    normal: "通常勤務",
    paid_leave: "有給",
    half_day: "半休",
    other: "その他",
  };
  return labels[workType] ?? workType;
}
