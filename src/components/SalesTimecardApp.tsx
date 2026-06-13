"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardLegalLinks } from "@/components/DashboardLegalLinks";
import { formatTime } from "@/lib/attendance";
import { getBillingRestrictionMessage, isCompanySubscriptionActive } from "@/lib/billing-status";
import {
  getRequestStatusLabel,
  getRequestTypeLabel,
  getWorkTypeLabel,
  SALES_WORK_TYPE_OPTIONS,
} from "@/lib/time-edit";
import { AppNotification, Attendance, SalesWorkType, TimeEditHistory, TimeEditRequest, TimeEditRequestType } from "@/lib/types";

type ActiveTab = "home" | "calendar" | "monthly" | "requests";
type Status = "not_clocked_in" | "working" | "clocked_out";
type SalesAttendance = Attendance & {
  profiles?: { name?: string | null; email?: string | null; role?: string | null } | null;
};

type MonthlySummary = {
  totalGrossMinutes: number;
  totalBreakMinutes: number;
  totalWorkMinutes: number;
  overtimeMinutes: number;
  workedDays: number;
};

type TimecardPayload = {
  company: {
    id: string;
    name: string;
    plan?: string;
    subscription_status?: string | null;
    billing_grace_period_started_at?: string | null;
    billing_grace_period_ends_at?: string | null;
  } | null;
  billingRestricted?: boolean;
  message?: string;
  workDate: string;
  selectedMonth: string;
  todayLog: SalesAttendance | null;
  attendance: SalesAttendance[];
  calendarRows: SalesAttendance[];
  monthlyRows: SalesAttendance[];
  ownMonthRows: SalesAttendance[];
  summary: MonthlySummary;
};

type CalendarDayResponse = {
  attendance: SalesAttendance | null;
  message?: string;
};

type StaffTimeEditRequest = TimeEditRequest & {
  attendance?: Pick<Attendance, "id" | "clock_in" | "clock_out" | "break_minutes" | "work_type"> | null;
};

type RequestForm = {
  targetDate: string;
  requestType: TimeEditRequestType;
  requestedClockIn: string;
  requestedClockOut: string;
  requestedBreakMinutes: string;
  reason: string;
};

const BASIC_WORK_MINUTES = 480;

const workTypeOptions = SALES_WORK_TYPE_OPTIONS;

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
  const [savingDates, setSavingDates] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<StaffTimeEditRequest[]>([]);
  const [histories, setHistories] = useState<TimeEditHistory[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>(() => ({
    targetDate: getDateKey(new Date()),
    requestType: "wrong_time",
    requestedClockIn: "",
    requestedClockOut: "",
    requestedBreakMinutes: "60",
    reason: "",
  }));

  const timecardReady = payload !== null;
  const todayLog = payload?.todayLog ?? null;
  const status = timecardReady ? getStatus(todayLog) : null;
  const todayWorkMinutes = timecardReady ? getWorkMinutes(todayLog, status === "working" ? now : null) : 0;
  const progress = Math.min(100, (todayWorkMinutes / BASIC_WORK_MINUTES) * 100);
  const calendarRows = payload?.calendarRows ?? payload?.ownMonthRows ?? [];
  const monthlyRows = payload?.monthlyRows ?? payload?.ownMonthRows ?? [];
  const summary = payload?.summary ?? emptySummary();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const billingRestricted =
    Boolean(payload?.billingRestricted) || (payload?.company ? !isCompanySubscriptionActive(payload.company) : false);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auth/timecard?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(formatApiError(data));

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

  const loadTimeEditData = useCallback(async () => {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [requestsResponse, historyResponse, notificationsResponse] = await Promise.all([
        fetch("/api/time-edit-requests", { headers }),
        fetch("/api/time-edit-history", { headers }),
        fetch("/api/notifications", { headers }),
      ]);
      const [requestsPayload, historyPayload, notificationsPayload] = await Promise.all([
        requestsResponse.json(),
        historyResponse.json(),
        notificationsResponse.json(),
      ]);

      if (requestsResponse.ok) setRequests(requestsPayload.requests ?? []);
      if (historyResponse.ok) setHistories(historyPayload.histories ?? []);
      if (notificationsResponse.ok) setNotifications(notificationsPayload.notifications ?? []);
    } catch {
      setMessage("修正依頼データの取得に失敗しました。");
    }
  }, [session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    queueMicrotask(() => void loadTimeEditData());
  }, [loadTimeEditData]);

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

  async function toggleCalendarDay(date: string) {
    if (!session || !payload || savingDates.has(date)) return;

    const previousAttendance = findCalendarDayAttendance(payload, date);
    setSavingDates((current) => new Set(current).add(date));
    setMessage("");
    setPayload((current) => (current ? toggleCalendarDayOptimistically(current, date, profile) : current));

    try {
      const response = await fetch("/api/auth/calendar-day", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date }),
      });
      const data = (await response.json()) as CalendarDayResponse;
      if (!response.ok) throw new Error(formatApiError(data));

      setPayload((current) => (current ? applyCalendarDayAttendance(current, date, data.attendance) : current));
      if (data.message) setMessage(data.message);
    } catch (error) {
      setPayload((current) => (current ? applyCalendarDayAttendance(current, date, previousAttendance) : current));
      setMessage(error instanceof Error ? error.message : "休日設定に失敗しました。");
    } finally {
      setSavingDates((current) => {
        const next = new Set(current);
        next.delete(date);
        return next;
      });
    }
  }

  async function submitTimeEditRequest() {
    if (!session) return;
    if (!requestForm.reason.trim()) {
      setMessage("理由を入力してください。");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/time-edit-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(formatApiError(data));
      setRequestModalOpen(false);
      setRequestForm((current) => ({ ...current, reason: "" }));
      setMessage("打刻修正依頼を送信しました。");
      await loadTimeEditData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打刻修正依頼の送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationRead(id: string) {
    if (!session) return;
    const response = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
    if (response.ok) await loadTimeEditData();
  }

  if (payload && billingRestricted) {
    return (
      <main data-route="sales-timecard-app-billing-restricted" className="min-h-screen bg-white px-5 pb-10 pt-10 text-[#0F172A]">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <AppHeader
            companyName={payload.company?.name ?? "Timecard"}
            userName={profile?.name ?? ""}
            onRefresh={loadData}
          />
          <StaffBillingRestrictedCard message={payload.message ?? getBillingRestrictionMessage()} />
          <DashboardLegalLinks showContact={false} onSignOut={signOut} />
        </div>
      </main>
    );
  }

  return (
    <main data-route="sales-timecard-app" className="min-h-screen bg-white pb-28 pt-10 text-[#0F172A]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5">
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

        {activeTab === "home" && status ? (
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
            onClockIn={() => postJson("/api/auth/clock-in", { workType, breakMinutes })}
            onClockOut={() => postJson("/api/auth/clock-out", { breakMinutes })}
          />
        ) : null}

        {activeTab === "home" && !status ? <HomeStatusLoading now={now} /> : null}

        {activeTab === "calendar" ? (
          <CalendarTab
            selectedMonth={selectedMonth}
            rows={calendarRows}
            loading={loading}
            savingDates={savingDates}
            onMonthChange={setSelectedMonth}
            onToggleHoliday={toggleCalendarDay}
          />
        ) : null}

        {activeTab === "monthly" ? (
          <MonthlyTab
            selectedMonth={selectedMonth}
            rows={monthlyRows}
            summary={summary}
            onMonthChange={setSelectedMonth}
          />
        ) : null}

        {activeTab === "requests" ? (
          <RequestsTab
            requests={requests}
            histories={histories}
            notifications={notifications}
            unreadCount={unreadCount}
            onOpenRequest={() => setRequestModalOpen(true)}
            onReadNotification={markNotificationRead}
          />
        ) : null}

        <DashboardLegalLinks showContact={false} onSignOut={signOut} />
      </div>

      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      {requestModalOpen ? (
        <TimeEditRequestModal
          form={requestForm}
          loading={loading}
          onChange={setRequestForm}
          onClose={() => setRequestModalOpen(false)}
          onSubmit={submitTimeEditRequest}
        />
      ) : null}
    </main>
  );
}

function StaffBillingRestrictedCard({ message }: { message: string }) {
  return (
    <section className="rounded-2xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
      <p className="text-sm font-black text-amber-700">利用開始手続きが必要です</p>
      <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950">管理者による利用開始手続きが必要です</h2>
      <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{message}</p>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        staffアカウントでは支払い手続きはできません。会社のownerに確認してください。
      </p>
    </section>
  );
}

function formatApiError(data: unknown) {
  if (!data || typeof data !== "object") return "APIエラーの内容を取得できませんでした。";
  const payload = data as {
    message?: string;
    error?: string;
    detail?: string;
    supabaseCode?: string;
    supabaseDetails?: string;
    supabaseHint?: string;
  };
  return [
    payload.message,
    payload.error ? `error: ${payload.error}` : null,
    payload.detail ? `detail: ${payload.detail}` : null,
    payload.supabaseCode ? `code: ${payload.supabaseCode}` : null,
    payload.supabaseDetails ? `details: ${payload.supabaseDetails}` : null,
    payload.supabaseHint ? `hint: ${payload.supabaseHint}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function findCalendarDayAttendance(payload: TimecardPayload, date: string) {
  return (
    payload.calendarRows.find((row) => row.work_date === date) ??
    payload.ownMonthRows.find((row) => row.work_date === date) ??
    payload.monthlyRows.find((row) => row.work_date === date) ??
    payload.attendance.find((row) => row.work_date === date) ??
    null
  );
}

function toggleCalendarDayOptimistically(
  payload: TimecardPayload,
  date: string,
  profile: { id?: string; user_id?: string; company_id?: string; store_id?: string | null } | null,
) {
  const existing = findCalendarDayAttendance(payload, date);
  const updatedAt = new Date().toISOString();
  const nextAttendance =
    existing?.day_type === "holiday"
      ? existing.clock_in || existing.clock_out
        ? { ...existing, day_type: "workday" as const, updated_at: updatedAt }
        : null
      : existing
        ? { ...existing, day_type: "holiday" as const, updated_at: updatedAt }
        : createOptimisticHolidayAttendance(payload, date, profile, updatedAt);

  return applyCalendarDayAttendance(payload, date, nextAttendance);
}

function createOptimisticHolidayAttendance(
  payload: TimecardPayload,
  date: string,
  profile: { id?: string; user_id?: string; company_id?: string; store_id?: string | null } | null,
  timestamp: string,
): SalesAttendance {
  return {
    id: `optimistic-holiday-${date}`,
    company_id: profile?.company_id ?? payload.company?.id ?? "",
    user_id: profile?.user_id ?? "",
    profile_id: profile?.id ?? null,
    store_id: profile?.store_id ?? null,
    work_type: "normal",
    break_minutes: 60,
    day_type: "holiday",
    note: null,
    clock_in: null,
    clock_out: null,
    work_date: date,
    created_at: timestamp,
    updated_at: timestamp,
    profiles: null,
  };
}

function applyCalendarDayAttendance(payload: TimecardPayload, date: string, attendance: SalesAttendance | null) {
  return {
    ...payload,
    attendance: upsertCalendarDayRow(payload.attendance, date, attendance),
    calendarRows: upsertCalendarDayRow(payload.calendarRows, date, attendance),
    monthlyRows: upsertCalendarDayRow(payload.monthlyRows, date, attendance),
    ownMonthRows: upsertCalendarDayRow(payload.ownMonthRows, date, attendance),
  };
}

function upsertCalendarDayRow(rows: SalesAttendance[], date: string, attendance: SalesAttendance | null) {
  const nextRows = rows.filter((row) => row.work_date !== date);
  if (!attendance) return nextRows;
  return [...nextRows, attendance].sort((a, b) => {
    const dateOrder = a.work_date.localeCompare(b.work_date);
    if (dateOrder !== 0) return dateOrder;
    return (a.clock_in ?? "").localeCompare(b.clock_in ?? "");
  });
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
      <div className="absolute left-0 top-0 flex max-w-[calc(100%-56px)] items-center gap-3">
        <p className="min-w-0 truncate text-sm font-black text-[#4F46E5]">{companyName}</p>
      </div>
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

function HomeStatusLoading({ now }: { now: Date }) {
  return (
    <>
      <section className="text-center">
        <p className="text-6xl font-black tracking-normal">{formatClock(now)}</p>
        <p className="mt-3 text-xl font-black text-slate-500">{formatDate(now)}</p>
      </section>

      <section className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EEF2FF] text-[#6366F1]">
          <IconClock />
        </div>
        <h2 className="mt-4 text-xl font-black text-slate-950">勤怠状態を確認中</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">最新の打刻状態を読み込んでいます。</p>
      </section>
    </>
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
        <OjisanCompanion status={status} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-500">本日の勤務時間</p>
            <p className="mt-4 text-4xl font-black">{formatDuration(todayWorkMinutes)}</p>
            <p className="mt-3 text-base font-black text-slate-500">
              {status === "working" ? "リアルタイムで更新中" : "本日の記録から集計"}
            </p>
          </div>
          <ProgressRing progress={progress} label={formatDuration(todayWorkMinutes)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <TimeMetric label="出勤時刻" value={formatTime(todayLog?.clock_in ?? null)} />
          <TimeMetric label="退勤時刻" value={formatTime(todayLog?.clock_out ?? null)} />
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
            勤務区分
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
            休憩設定
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

function TimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

const ojisanImagesByStatus: Record<Status, string> = {
  not_clocked_in: "/characters/ojisan/before-work.png",
  working: "/characters/ojisan/working.png",
  clocked_out: "/characters/ojisan/after-work.png",
};

const ojisanMessagesByStatus: Record<Status, string[]> = {
  not_clocked_in: [
    "今日仕事休んじゃおうかなぁ",
    "布団が離してくれんかった",
    "有給って便利な制度だよなぁ",
    "今日はなんか眠いなぁ",
    "とりあえず会社行くか",
    "朝って毎日来るんだなぁ",
  ],
  working: [
    "今日もぼちぼちやりますか",
    "働いとるな、えらい",
    "焦らんでも昼は来る",
    "コーヒーもう一杯ほしいな",
    "あとで休憩しよう",
    "無理せん程度にな",
  ],
  clocked_out: [
    "とりあえずビールで乾杯",
    "今日はよう働いた",
    "風呂入って寝るか",
    "晩飯なにかなぁ",
    "明日のことは明日考えよう",
    "おつかれさんでした",
  ],
};

function OjisanCompanion({ status }: { status: Status }) {
  const todayKey = getDateKey(new Date());
  const message = useSyncExternalStore(
    subscribeOjisanMessage,
    () => getDailyOjisanMessage(status, todayKey),
    () => ojisanMessagesByStatus[status][0],
  );

  return (
    <section className="flex items-center gap-4 rounded-xl bg-slate-50/90 px-3 py-4 ring-1 ring-slate-100">
      <span className="grid h-[152px] w-[152px] shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
        <Image
          src={ojisanImagesByStatus[status]}
          alt=""
          width={152}
          height={152}
          className="h-[144px] w-[144px] object-contain [image-rendering:pixelated]"
        />
      </span>
      <p className="relative min-w-0 rounded-xl bg-white px-4 py-5 text-base font-bold leading-7 text-slate-600 shadow-sm ring-1 ring-slate-100 before:absolute before:left-[-6px] before:top-1/2 before:h-3 before:w-3 before:-translate-y-1/2 before:rotate-45 before:bg-white before:ring-1 before:ring-slate-100">
        <span className="relative">{message}</span>
      </p>
    </section>
  );
}

function subscribeOjisanMessage() {
  return () => {};
}

function getDailyOjisanMessage(status: Status, dateKey: string) {
  const messages = ojisanMessagesByStatus[status];
  const storageKey = `ojisan-companion-message:v1:${dateKey}:${status}`;

  if (typeof window === "undefined") return messages[0];

  try {
    const storedIndex = Number(window.localStorage.getItem(storageKey));
    if (Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < messages.length) {
      return messages[storedIndex];
    }

    const nextIndex = Math.floor(Math.random() * messages.length);
    window.localStorage.setItem(storageKey, String(nextIndex));
    return messages[nextIndex];
  } catch {
    return messages[0];
  }
}

function CalendarTab({
  selectedMonth,
  rows,
  loading,
  savingDates,
  onMonthChange,
  onToggleHoliday,
}: {
  selectedMonth: string;
  rows: SalesAttendance[];
  loading: boolean;
  savingDates: Set<string>;
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
      <section aria-busy={loading} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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
            const isSaving = savingDates.has(cell.dateKey);

            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={isSaving || !cell.inMonth}
                onClick={() => onToggleHoliday(cell.dateKey)}
                className={`relative grid min-h-14 place-items-center rounded-full text-sm font-black transition active:scale-95 disabled:opacity-40 ${
                  cell.inMonth ? "text-slate-900" : "text-slate-300"
                } ${isSavedHoliday ? "bg-rose-400 text-white" : ""} ${
                  isToday ? "ring-2 ring-[#6366F1]" : ""
                } ${isSaving ? "opacity-60" : ""}`}
              >
                {cell.day}
                <span className="absolute bottom-1 flex gap-0.5">
                  {hasWork ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                  {isHoliday ? <span className={`h-1.5 w-1.5 rounded-full ${isSavedHoliday ? "bg-white" : "bg-slate-300"}`} /> : null}
                  {dayRows.some((row) => isSpecialWorkType(row.work_type)) ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  ) : null}
                </span>
                {isSaving ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#6366F1]" /> : null}
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
  summary: MonthlySummary;
  onMonthChange: (month: string) => void;
}) {
  return (
    <>
      <ScreenHeader title="月次" subtitle="打刻データのみで集計" />
      <MonthStepper selectedMonth={selectedMonth} onMonthChange={onMonthChange} />
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-black text-slate-500">対象月</p>
        <p className="mt-2 text-2xl font-black">{formatMonth(selectedMonth)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <SummaryCard label="勤務日数" value={`${summary.workedDays}日`} />
          <SummaryCard label="総勤務時間" value={formatDuration(summary.totalGrossMinutes)} />
          <SummaryCard label="総残業時間" value={formatDuration(summary.overtimeMinutes)} />
          <SummaryCard label="総実働時間" value={formatDuration(summary.totalWorkMinutes)} />
        </div>
      </section>
      <ScreenHeader title="勤務記録一覧" subtitle="出勤打刻がある日のみ表示" />
      <section className="grid gap-3">
        {rows.length ? (
          rows.map((row) => {
            const workMinutes = getWorkMinutes(row, null);
            const missingClockOut = Boolean(row.clock_in && !row.clock_out);
            return (
              <article key={row.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-black">{formatShortDate(row.work_date)}</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">勤務区分</p>
                    <p className="text-base font-black">{getWorkTypeLabel(row.work_type)}</p>
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-sm font-bold text-slate-500">出勤 {formatTime(row.clock_in)}</p>
                    <p className={`mt-1 text-sm font-bold ${missingClockOut ? "text-rose-500" : "text-slate-500"}`}>
                      退勤 {missingClockOut ? "退勤未打刻" : formatTime(row.clock_out)}
                    </p>
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      勤務 {missingClockOut ? "未確定" : formatDuration(getGrossMinutes(row))}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      休憩 {getBreakLabel(row.break_minutes)}
                    </p>
                    <p className="mt-1 text-lg font-black">
                      実働 {missingClockOut ? "未確定" : formatDuration(workMinutes)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-slate-400 shadow-sm">
            この月の打刻記録はありません。
          </p>
        )}
      </section>
    </>
  );
}

function RequestsTab({
  requests,
  histories,
  notifications,
  unreadCount,
  onOpenRequest,
  onReadNotification,
}: {
  requests: StaffTimeEditRequest[];
  histories: TimeEditHistory[];
  notifications: AppNotification[];
  unreadCount: number;
  onOpenRequest: () => void;
  onReadNotification: (id: string) => void;
}) {
  return (
    <>
      <ScreenHeader title="打刻修正" subtitle={unreadCount ? `未読通知 ${unreadCount}件` : "申請と通知"} />
      <button
        type="button"
        onClick={onOpenRequest}
        className="flex h-16 items-center justify-between rounded-2xl bg-slate-950 px-5 text-left text-white shadow-sm transition active:scale-95"
      >
        <span className="text-lg font-black">打刻修正依頼</span>
        <span className="text-2xl">＋</span>
      </button>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-lg font-black">通知</h3>
        <div className="mt-4 grid gap-3">
          {notifications.length ? (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => onReadNotification(notification.id)}
                className={`rounded-2xl p-4 text-left ring-1 ring-slate-100 ${
                  notification.read_at ? "bg-slate-50 text-slate-500" : "bg-blue-50 text-slate-950"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black">{notification.title}</p>
                  <span className="shrink-0 text-xs font-black">{notification.read_at ? "既読" : "未読"}</span>
                </div>
                <p className="mt-2 text-sm font-bold leading-6">{notification.body}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">{formatDateTime(notification.created_at)}</p>
              </button>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">通知はありません。</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-lg font-black">自分の修正依頼</h3>
        <div className="mt-4 grid gap-3">
          {requests.length ? (
            requests.map((request) => (
              <article key={request.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{request.target_date}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{getRequestTypeLabel(request.request_type)}</p>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <RequestMetric label="希望出勤" value={formatTime(request.requested_clock_in)} />
                  <RequestMetric label="希望退勤" value={formatTime(request.requested_clock_out)} />
                  <RequestMetric label="希望休憩" value={request.requested_break_minutes === null ? "-" : `${request.requested_break_minutes}分`} />
                  <RequestMetric label="申請日時" value={formatDateTime(request.created_at)} />
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">理由: {request.reason}</p>
                {request.owner_comment ? <p className="mt-2 text-sm font-bold text-slate-500">ownerコメント: {request.owner_comment}</p> : null}
              </article>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">修正依頼はありません。</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-lg font-black">修正履歴</h3>
        <div className="mt-4 grid gap-3">
          {histories.length ? (
            histories.map((history) => (
              <article key={history.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black">{history.source === "direct" ? "owner直接修正" : "依頼経由"}</p>
                  <p className="text-xs font-bold text-slate-500">{formatDateTime(history.created_at)}</p>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-600">
                  出勤 {formatTime(history.before_clock_in)} → {formatTime(history.after_clock_in)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  退勤 {formatTime(history.before_clock_out)} → {formatTime(history.after_clock_out)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  休憩 {history.before_break_minutes ?? "-"}分 → {history.after_break_minutes ?? "-"}分
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">理由: {history.reason}</p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">修正履歴はありません。</p>
          )}
        </div>
      </section>
    </>
  );
}

function TimeEditRequestModal({
  form,
  loading,
  onChange,
  onClose,
  onSubmit,
}: {
  form: RequestForm;
  loading: boolean;
  onChange: (form: RequestForm | ((current: RequestForm) => RequestForm)) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/40 px-4 py-5 backdrop-blur-sm">
      <div className="mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">打刻修正依頼</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">attendanceは直接更新されません。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-black">
            ×
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="text-sm font-black text-slate-500">
            対象日
            <input
              type="date"
              value={form.targetDate}
              onChange={(event) => onChange((current) => ({ ...current, targetDate: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base font-black"
            />
          </label>
          <label className="text-sm font-black text-slate-500">
            修正種別
            <select
              value={form.requestType}
              onChange={(event) => onChange((current) => ({ ...current, requestType: event.target.value as TimeEditRequestType }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-black"
            >
              <option value="missing_clock_in">出勤忘れ</option>
              <option value="missing_clock_out">退勤忘れ</option>
              <option value="wrong_time">時刻間違い</option>
              <option value="break_fix">休憩時間修正</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label className="text-sm font-black text-slate-500">
            希望出勤時刻
            <input
              type="time"
              value={form.requestedClockIn}
              onChange={(event) => onChange((current) => ({ ...current, requestedClockIn: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base font-black"
            />
          </label>
          <label className="text-sm font-black text-slate-500">
            希望退勤時刻
            <input
              type="time"
              value={form.requestedClockOut}
              onChange={(event) => onChange((current) => ({ ...current, requestedClockOut: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base font-black"
            />
          </label>
          <label className="text-sm font-black text-slate-500">
            希望休憩時間（分）
            <input
              type="number"
              min="0"
              max="240"
              value={form.requestedBreakMinutes}
              onChange={(event) => onChange((current) => ({ ...current, requestedBreakMinutes: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base font-black"
            />
          </label>
          <label className="text-sm font-black text-slate-500">
            理由
            <textarea
              value={form.reason}
              onChange={(event) => onChange((current) => ({ ...current, reason: event.target.value }))}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-bold"
              required
            />
          </label>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="h-12 rounded-xl bg-slate-100 font-black text-slate-700">
            キャンセル
          </button>
          <button type="button" disabled={loading} onClick={onSubmit} className="h-12 rounded-xl bg-slate-950 font-black text-white disabled:bg-slate-300">
            送信
          </button>
        </div>
      </div>
    </div>
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
    { id: "requests", label: "修正", icon: "!" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-sm backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
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
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function RequestMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>{getRequestStatusLabel(status)}</span>;
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
    ["bg-orange-400", "勤務区分あり"],
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

function getGrossMinutes(row: SalesAttendance | null) {
  if (!row?.clock_in || !row.clock_out) return 0;
  return Math.max(0, Math.floor((new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / 60000));
}

function getWorkMinutes(row: SalesAttendance | null, now: Date | null) {
  if (!row?.clock_in) return 0;
  const end = row.clock_out ? new Date(row.clock_out) : now;
  if (!end) return 0;
  const raw = Math.floor((end.getTime() - new Date(row.clock_in).getTime()) / 60000);
  return Math.max(0, raw - row.break_minutes);
}


function isSpecialWorkType(value: SalesWorkType) {
  return value !== "normal";
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function emptySummary(): MonthlySummary {
  return {
    totalGrossMinutes: 0,
    totalBreakMinutes: 0,
    totalWorkMinutes: 0,
    overtimeMinutes: 0,
    workedDays: 0,
  };
}
