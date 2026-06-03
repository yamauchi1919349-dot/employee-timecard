"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BASIC_WORK_MINUTES, formatTime } from "@/lib/attendance";
import { Attendance, SalesWorkType } from "@/lib/types";

type ActiveTab = "home" | "calendar" | "monthly" | "pdf";

type SalesAttendance = Attendance & {
  profiles?: { name?: string | null; email?: string | null; role?: string | null } | null;
};

type TimecardPayload = {
  company: { id: string; name: string; plan?: string } | null;
  workDate: string;
  selectedMonth: string;
  todayLog: SalesAttendance | null;
  attendance: SalesAttendance[];
  ownMonthRows: SalesAttendance[];
  summary: {
    totalWorkMinutes: number;
    overtimeMinutes: number;
    workedDays: number;
  };
};

const workTypeOptions: { value: SalesWorkType; label: string }[] = [
  { value: "normal", label: "通常勤務" },
  { value: "paid_leave", label: "有給" },
  { value: "half_day", label: "半休" },
  { value: "other", label: "その他" },
];

const breakOptions = [
  { value: 60, label: "1時間" },
  { value: 0, label: "休憩なし" },
  { value: 45, label: "45分" },
  { value: 90, label: "1時間30分" },
];

export function SalesTimecardApp() {
  const { session, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [payload, setPayload] = useState<TimecardPayload | null>(null);
  const [workType, setWorkType] = useState<SalesWorkType>("normal");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isAdmin = profile?.role === "owner" || profile?.role === "manager";
  const todayLog = payload?.todayLog ?? null;
  const status = getStatus(todayLog);
  const todayWorkMinutes = getWorkMinutes(todayLog, status === "working" ? now : null);
  const progress = Math.min(100, (todayWorkMinutes / BASIC_WORK_MINUTES) * 100);
  const visibleRows = profile?.role === "staff" ? payload?.ownMonthRows ?? [] : payload?.attendance ?? [];

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auth/timecard?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setPayload(data);
      if (data.todayLog) {
        setWorkType(data.todayLog.work_type ?? "normal");
        setBreakMinutes(data.todayLog.break_minutes ?? 60);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "勤怠データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  async function clockIn() {
    if (!session) return;
    await postClock("/api/auth/clock-in", { workType, breakMinutes });
  }

  async function clockOut() {
    if (!session) return;
    await postClock("/api/auth/clock-out", { breakMinutes });
  }

  async function postClock(path: string, body: unknown) {
    if (!session) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打刻に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-route="sales-timecard-app" className="min-h-screen bg-slate-50 pb-28 pt-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4">
        <header className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-bold text-indigo-600">{payload?.company?.name ?? "Timecard"}</p>
            <h1 className="mt-1 text-2xl font-black">{profile?.name ?? "読み込み中"}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{profile?.role}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="h-11 rounded-2xl bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"
          >
            ログアウト
          </button>
        </header>

        {message ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 shadow-sm">
            {message}
          </p>
        ) : null}

        {activeTab === "home" ? (
          <HomeTab
            now={now}
            status={status}
            todayLog={todayLog}
            todayWorkMinutes={todayWorkMinutes}
            progress={progress}
            workType={workType}
            breakMinutes={breakMinutes}
            loading={loading}
            isAdmin={isAdmin}
            attendance={payload?.attendance ?? []}
            onWorkTypeChange={setWorkType}
            onBreakMinutesChange={setBreakMinutes}
            onClockIn={clockIn}
            onClockOut={clockOut}
          />
        ) : null}

        {activeTab === "calendar" ? (
          <CalendarTab
            selectedMonth={selectedMonth}
            rows={visibleRows}
            onMonthChange={setSelectedMonth}
          />
        ) : null}

        {activeTab === "monthly" ? (
          <MonthlyTab
            selectedMonth={selectedMonth}
            rows={visibleRows}
            summary={payload?.summary ?? { totalWorkMinutes: 0, overtimeMinutes: 0, workedDays: 0 }}
            onMonthChange={setSelectedMonth}
          />
        ) : null}

        {activeTab === "pdf" && isAdmin ? (
          <PdfTab selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
        ) : null}
      </div>

      <BottomTabs activeTab={activeTab} isAdmin={isAdmin} onChange={setActiveTab} />
    </main>
  );
}

function HomeTab({
  now,
  status,
  todayLog,
  todayWorkMinutes,
  progress,
  workType,
  breakMinutes,
  loading,
  isAdmin,
  attendance,
  onWorkTypeChange,
  onBreakMinutesChange,
  onClockIn,
  onClockOut,
}: {
  now: Date;
  status: ReturnType<typeof getStatus>;
  todayLog: SalesAttendance | null;
  todayWorkMinutes: number;
  progress: number;
  workType: SalesWorkType;
  breakMinutes: number;
  loading: boolean;
  isAdmin: boolean;
  attendance: SalesAttendance[];
  onWorkTypeChange: (value: SalesWorkType) => void;
  onBreakMinutesChange: (value: number) => void;
  onClockIn: () => void;
  onClockOut: () => void;
}) {
  return (
    <>
      <section className="py-5 text-center">
        <p className="text-6xl font-black tracking-normal text-slate-950">{formatClock(now)}</p>
        <p className="mt-3 text-lg font-bold text-slate-500">{formatDate(now)}</p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${status === "working" ? "bg-indigo-500" : "bg-slate-300"}`} />
              <h2 className="text-2xl font-black">{getStatusLabel(status)}</h2>
            </div>
            <p className="mt-5 text-sm font-bold text-slate-500">
              出勤 {formatTime(todayLog?.clock_in ?? null)}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              退勤 {formatTime(todayLog?.clock_out ?? null)}
            </p>
          </div>
          <ProgressRing progress={progress} label={formatDuration(todayWorkMinutes)} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-500">本日の勤務時間</p>
        <p className="mt-2 text-4xl font-black">{formatDuration(todayWorkMinutes)}</p>
      </section>

      {!isAdmin ? (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-slate-500">
                勤務区分
                <select
                  value={workType}
                  disabled={status !== "not_clocked_in"}
                  onChange={(event) => onWorkTypeChange(event.target.value as SalesWorkType)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-bold"
                >
                  {workTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-500">
                休憩設定
                <select
                  value={breakMinutes}
                  disabled={status === "clocked_out"}
                  onChange={(event) => onBreakMinutesChange(Number(event.target.value))}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-bold"
                >
                  {breakOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClockIn}
              disabled={loading || status !== "not_clocked_in"}
              className="h-16 rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-sm disabled:bg-slate-200 disabled:text-slate-500"
            >
              出勤
            </button>
            <button
              type="button"
              onClick={onClockOut}
              disabled={loading || status !== "working"}
              className="h-16 rounded-2xl bg-orange-500 text-lg font-black text-white shadow-sm disabled:bg-slate-200 disabled:text-slate-500"
            >
              退勤
            </button>
          </div>
        </>
      ) : (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">本日の出勤者</h2>
            <Link href="/admin/staff" className="text-sm font-bold text-indigo-600">
              スタッフ管理
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {attendance.length ? (
              attendance.map((row) => (
                <div key={row.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold">{row.profiles?.name ?? row.user_id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatTime(row.clock_in)} - {formatTime(row.clock_out)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-bold text-slate-400">本日の出勤者はまだいません。</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function CalendarTab({
  selectedMonth,
  rows,
  onMonthChange,
}: {
  selectedMonth: string;
  rows: SalesAttendance[];
  onMonthChange: (month: string) => void;
}) {
  const rowByDate = useMemo(
    () =>
      rows.reduce<Record<string, SalesAttendance[]>>((index, row) => {
        index[row.work_date] = [...(index[row.work_date] ?? []), row];
        return index;
      }, {}),
    [rows],
  );

  return (
    <>
      <ScreenHeader title="カレンダー" subtitle="月間の出勤・休日・シフト" />
      <MonthStepper selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 text-center text-sm font-black text-slate-400">
          {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {buildCalendarCells(selectedMonth).map((cell) => {
            const dayRows = rowByDate[cell.dateKey] ?? [];
            const hasWork = dayRows.some((row) => row.clock_in);
            const isHoliday = dayRows.some((row) => row.day_type === "holiday") || cell.weekend;
            const isToday = cell.dateKey === getDateKey(new Date());

            return (
              <div
                key={cell.dateKey}
                className={`min-h-16 rounded-xl p-1 text-center ${
                  cell.inMonth ? "bg-slate-50" : "bg-transparent text-slate-300"
                } ${isHoliday && cell.inMonth ? "bg-rose-50 text-rose-600" : ""} ${
                  isToday ? "ring-2 ring-indigo-500" : ""
                }`}
              >
                <p className="text-sm font-black">{cell.day}</p>
                {hasWork ? <p className="mt-1 text-[11px] font-black text-indigo-600">出</p> : null}
                {isHoliday && cell.inMonth ? <p className="mt-1 text-[11px] font-black">休</p> : null}
                {dayRows.some((row) => row.day_type === "shift") ? (
                  <p className="mt-1 text-[11px] font-black text-emerald-600">シ</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MonthlyTab({
  selectedMonth,
  rows,
  summary,
  onMonthChange,
}: {
  selectedMonth: string;
  rows: SalesAttendance[];
  summary: TimecardPayload["summary"];
  onMonthChange: (month: string) => void;
}) {
  return (
    <>
      <ScreenHeader title="月次" subtitle="ひと月のまとめ" />
      <MonthStepper selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
      <section className="grid grid-cols-3 gap-3">
        <SummaryCard label="勤務時間" value={formatDuration(summary.totalWorkMinutes)} />
        <SummaryCard label="残業" value={formatDuration(summary.overtimeMinutes)} />
        <SummaryCard label="出勤日数" value={`${summary.workedDays}日`} />
      </section>
      <section className="grid gap-3">
        {rows.length ? (
          rows.map((row) => {
            const workMinutes = getWorkMinutes(row, null);
            const overtimeMinutes = Math.max(0, workMinutes - BASIC_WORK_MINUTES);
            return (
              <article key={row.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{formatShortDate(row.work_date)}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {formatTime(row.clock_in)} - {formatTime(row.clock_out)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {getWorkTypeLabel(row.work_type)} / {getBreakLabel(row.break_minutes)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{formatDuration(workMinutes)}</p>
                    <p className="mt-1 text-sm font-bold text-rose-500">
                      残業 {formatDuration(overtimeMinutes)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-slate-400 shadow-sm">
            この月の勤怠記録はありません。
          </p>
        )}
      </section>
    </>
  );
}

function PdfTab({
  selectedMonth,
  onMonthChange,
}: {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <>
      <ScreenHeader title="PDF" subtitle="管理者向け出力" />
      <MonthStepper selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">PDF出力</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          販売版PDFはログイン中の企業データだけを対象にする形へ移行中です。
        </p>
      </section>
    </>
  );
}

function BottomTabs({
  activeTab,
  isAdmin,
  onChange,
}: {
  activeTab: ActiveTab;
  isAdmin: boolean;
  onChange: (tab: ActiveTab) => void;
}) {
  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "home", label: "ホーム", icon: "⌂" },
    { id: "calendar", label: "カレンダー", icon: "□" },
    { id: "monthly", label: "月次", icon: "▤" },
    ...(isAdmin ? [{ id: "pdf" as ActiveTab, label: "PDF", icon: "▧" }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-sm backdrop-blur">
      <div className="mx-auto grid max-w-md gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`h-16 rounded-2xl text-sm font-black ${
                active ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <span className="block text-xl">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="px-1">
      <h2 className="text-3xl font-black">{title}</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">{subtitle}</p>
    </header>
  );
}

function MonthStepper({
  selectedMonth,
  onMonthChange,
}: {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="grid grid-cols-[48px_1fr_48px] items-center rounded-2xl bg-white p-2 shadow-sm">
      <button type="button" className="h-12 rounded-xl text-xl font-black text-indigo-600" onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}>
        ‹
      </button>
      <p className="text-center text-xl font-black">{formatMonth(selectedMonth)}</p>
      <button type="button" className="h-12 rounded-xl text-xl font-black text-indigo-600" onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}>
        ›
      </button>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg className="-rotate-90 h-24 w-24" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-indigo-50" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-indigo-600"
        />
      </svg>
      <p className="absolute text-center text-sm font-black">{label}</p>
    </div>
  );
}

function getStatus(row: SalesAttendance | null) {
  if (!row?.clock_in) return "not_clocked_in";
  if (!row.clock_out) return "working";
  return "clocked_out";
}

function getStatusLabel(status: ReturnType<typeof getStatus>) {
  if (status === "working") return "勤務中";
  if (status === "clocked_out") return "退勤済";
  return "未出勤";
}

function getWorkMinutes(row: SalesAttendance | null, now: Date | null) {
  if (!row?.clock_in) return 0;
  const end = row.clock_out ? new Date(row.clock_out) : now;
  if (!end) return 0;
  const raw = Math.floor((end.getTime() - new Date(row.clock_in).getTime()) / 60000);
  return Math.max(0, raw - row.break_minutes);
}

function getWorkTypeLabel(value: SalesWorkType) {
  return workTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function getBreakLabel(minutes: number) {
  return breakOptions.find((option) => option.value === minutes)?.label ?? `${minutes}分`;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${hours}時間${rest}分`;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return getMonthKey(date);
}

function buildCalendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDate = new Date(year, monthNumber - 1, 1);
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - firstDate.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      dateKey: getDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthNumber - 1,
      weekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}
