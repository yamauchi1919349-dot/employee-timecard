"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BASIC_WORK_MINUTES, formatTime } from "@/lib/attendance";
import { Attendance, SalesWorkType } from "@/lib/types";

type ActiveTab = "home" | "calendar" | "monthly" | "other";
type Status = "not_clocked_in" | "working" | "clocked_out";

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
  { value: 60, label: "1時間あり" },
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

  const rows = payload?.ownMonthRows ?? [];
  const todayLog = payload?.todayLog ?? null;
  const status = getStatus(todayLog);
  const todayWorkMinutes = getWorkMinutes(todayLog, status === "working" ? now : null);
  const progress = Math.min(100, (todayWorkMinutes / BASIC_WORK_MINUTES) * 100);

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
    await postJson("/api/auth/clock-in", { workType, breakMinutes });
  }

  async function clockOut() {
    await postJson("/api/auth/clock-out", { breakMinutes });
  }

  async function toggleHoliday(date: string) {
    await postJson("/api/auth/calendar-day", { date });
  }

  async function postJson(path: string, body: unknown) {
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
      if (data.message) setMessage(data.message);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-route="sales-timecard-app" className="min-h-screen bg-white pb-28 pt-8 text-[#0F172A]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5">
        <AppHeader
          companyName={payload?.company?.name ?? "Timecard"}
          userName={profile?.name ?? ""}
          onRefresh={loadData}
        />

        {message ? (
          <p className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm">
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
            onWorkTypeChange={setWorkType}
            onBreakMinutesChange={setBreakMinutes}
            onClockIn={clockIn}
            onClockOut={clockOut}
          />
        ) : null}

        {activeTab === "calendar" ? (
          <CalendarTab
            selectedMonth={selectedMonth}
            rows={rows}
            loading={loading}
            onMonthChange={setSelectedMonth}
            onToggleHoliday={toggleHoliday}
          />
        ) : null}

        {activeTab === "monthly" ? (
          <MonthlyTab
            selectedMonth={selectedMonth}
            rows={rows}
            summary={payload?.summary ?? { totalWorkMinutes: 0, overtimeMinutes: 0, workedDays: 0 }}
            onMonthChange={setSelectedMonth}
          />
        ) : null}

        {activeTab === "other" ? <OtherTab onSignOut={signOut} /> : null}
      </div>

      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}

function AppHeader({
  companyName,
  userName,
  onRefresh,
}: {
  companyName: string;
  userName: string;
  onRefresh: () => void;
}) {
  return (
    <header className="relative min-h-16 px-1">
      <p className="absolute left-0 top-0 text-sm font-black text-[#4F46E5]">{companyName}</p>
      <p className="pt-8 text-center text-sm font-black text-slate-500">{userName}</p>
      <button
        type="button"
        onClick={onRefresh}
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-white text-[#6366F1] shadow-sm ring-1 ring-slate-100"
        aria-label="更新"
      >
        ↻
      </button>
    </header>
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
  onWorkTypeChange,
  onBreakMinutesChange,
  onClockIn,
  onClockOut,
}: {
  now: Date;
  status: Status;
  todayLog: SalesAttendance | null;
  todayWorkMinutes: number;
  progress: number;
  workType: SalesWorkType;
  breakMinutes: number;
  loading: boolean;
  onWorkTypeChange: (value: SalesWorkType) => void;
  onBreakMinutesChange: (value: number) => void;
  onClockIn: () => void;
  onClockOut: () => void;
}) {
  const action = getPrimaryAction(status);

  return (
    <>
      <section className="text-center">
        <p className="text-6xl font-black tracking-normal">{formatClock(now)}</p>
        <p className="mt-3 text-xl font-black text-slate-500">{formatDate(now)}</p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${status === "not_clocked_in" ? "bg-slate-300" : "bg-[#6366F1]"}`} />
              <h2 className="text-2xl font-black">{getStatusLabel(status)}</h2>
            </div>
            <p className="mt-5 text-base font-black">出勤 {formatTime(todayLog?.clock_in ?? null)}</p>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#EEF2FF] text-[#6366F1]">
            <IconClock />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-500">本日の勤務時間</p>
            <p className="mt-4 text-4xl font-black">{formatDuration(todayWorkMinutes)}</p>
            <p className="mt-3 text-base font-black text-slate-500">
              {status === "working" ? "リアルタイムで更新中" : "本日の記録から集計"}
            </p>
          </div>
          <ProgressRing progress={progress} label={formatDuration(todayWorkMinutes)} />
        </div>
      </section>

      <button
        type="button"
        onClick={action.type === "clock_in" ? onClockIn : onClockOut}
        disabled={loading || action.disabled}
        className={`flex h-20 items-center justify-between rounded-2xl px-5 text-left text-white shadow-sm transition active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 ${action.className}`}
      >
        <span className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/80">
            {action.icon}
          </span>
          <span>
            <span className="block text-2xl font-black">{action.label}</span>
            <span className="mt-1 block text-sm font-bold opacity-90">{action.subLabel}</span>
          </span>
        </span>
        <span className="text-3xl font-light">›</span>
      </button>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-black text-slate-500">
            <span className="flex items-center gap-2 text-[#6B7280]">▣ 勤務区分</span>
            <select
              value={workType}
              disabled={status !== "not_clocked_in"}
              onChange={(event) => onWorkTypeChange(event.target.value as SalesWorkType)}
              className="mt-3 h-12 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-base font-black text-slate-700"
            >
              {workTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-black text-slate-500">
            <span className="flex items-center gap-2 text-[#6B7280]">☕ 休憩設定</span>
            <select
              value={breakMinutes}
              disabled={status === "clocked_out"}
              onChange={(event) => onBreakMinutesChange(Number(event.target.value))}
              className="mt-3 h-12 w-full rounded-xl border border-orange-100 bg-orange-400 px-3 text-base font-black text-white"
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
    </>
  );
}

function CalendarTab({
  selectedMonth,
  rows,
  loading,
  onMonthChange,
  onToggleHoliday,
}: {
  selectedMonth: string;
  rows: SalesAttendance[];
  loading: boolean;
  onMonthChange: (month: string) => void;
  onToggleHoliday: (date: string) => void;
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
      <ScreenHeader title="カレンダー" subtitle={formatMonth(selectedMonth)} />
      <MonthStepper selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="grid grid-cols-7 text-center text-sm font-black">
          {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
            <span key={day} className={index === 0 ? "text-rose-500" : index === 6 ? "text-blue-500" : "text-slate-500"}>
              {day}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {buildCalendarCells(selectedMonth).map((cell) => {
            const dayRows = rowByDate[cell.dateKey] ?? [];
            const hasWork = dayRows.some((row) => row.clock_in);
            const isSavedHoliday = dayRows.some((row) => row.day_type === "holiday");
            const isHoliday = isSavedHoliday || cell.weekend;
            const isToday = cell.dateKey === getDateKey(new Date());

            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={loading || !cell.inMonth}
                onClick={() => onToggleHoliday(cell.dateKey)}
                className={`relative grid min-h-14 place-items-center rounded-full text-sm font-black transition active:scale-95 disabled:opacity-40 ${
                  cell.inMonth ? "text-slate-900" : "text-slate-300"
                } ${isSavedHoliday ? "bg-rose-400 text-white" : ""} ${
                  isToday ? "ring-2 ring-[#6366F1]" : ""
                }`}
              >
                {cell.day}
                <span className="absolute bottom-1 flex gap-0.5">
                  {hasWork ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                  {isHoliday ? <span className={`h-1.5 w-1.5 rounded-full ${isSavedHoliday ? "bg-white" : "bg-slate-300"}`} /> : null}
                  {dayRows.some((row) => row.work_type === "paid_leave" || row.work_type === "other") ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <CalendarLegend />
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
              <article key={row.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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

function OtherTab({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <ScreenHeader title="その他" subtitle="アカウント" />
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <button
          type="button"
          onClick={onSignOut}
          className="h-12 w-full rounded-xl bg-slate-950 text-base font-black text-white"
        >
          ログアウト
        </button>
      </section>
    </>
  );
}

function BottomTabs({
  activeTab,
  onChange,
}: {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}) {
  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "home", label: "ホーム", icon: "⌂" },
    { id: "calendar", label: "カレンダー", icon: "□" },
    { id: "monthly", label: "月次", icon: "▤" },
    { id: "other", label: "その他", icon: "▧" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-sm backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`h-16 rounded-2xl text-xs font-black ${
                active ? "bg-indigo-50 text-[#6366F1] shadow-sm" : "text-slate-500"
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
      <h2 className="text-2xl font-black">{title}</h2>
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
    <div className="grid grid-cols-[48px_1fr_48px] items-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
      <button type="button" className="h-12 rounded-xl text-xl font-black text-[#6366F1]" onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}>
        ‹
      </button>
      <p className="text-center text-lg font-black">{formatMonth(selectedMonth)}</p>
      <button type="button" className="h-12 rounded-xl text-xl font-black text-[#6366F1]" onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}>
        ›
      </button>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-[#EEF2FF]" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-[#6366F1]"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs font-black text-slate-500">8h</p>
        <p className="text-xs font-black">{label}</p>
      </div>
    </div>
  );
}

function CalendarLegend() {
  const items = [
    ["bg-blue-500", "出勤日"],
    ["bg-rose-400", "休日"],
    ["bg-slate-300", "欠勤"],
    ["bg-orange-400", "有給・その他"],
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
      {items.map(([color, label]) => (
        <div key={label} className="flex items-center justify-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          {label}
        </div>
      ))}
    </div>
  );
}

function getPrimaryAction(status: Status) {
  if (status === "not_clocked_in") {
    return {
      type: "clock_in" as const,
      disabled: false,
      label: "出勤",
      subLabel: "勤務を開始します",
      icon: "▶",
      className: "bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]",
    };
  }
  if (status === "working") {
    return {
      type: "clock_out" as const,
      disabled: false,
      label: "退勤",
      subLabel: "退勤時刻を確認します",
      icon: "□",
      className: "bg-gradient-to-r from-[#FF7A1A] to-[#F97316]",
    };
  }
  return {
    type: "clock_out" as const,
    disabled: true,
    label: "本日は完了",
    subLabel: "おつかれさまでした",
    icon: "✓",
    className: "bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]",
  };
}

function getStatus(row: SalesAttendance | null): Status {
  if (!row?.clock_in) return "not_clocked_in";
  if (!row.clock_out) return "working";
  return "clocked_out";
}

function getStatusLabel(status: Status) {
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

function IconClock() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  if (hours <= 0) return `${rest}分`;
  if (rest <= 0) return `${hours}時間`;
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
