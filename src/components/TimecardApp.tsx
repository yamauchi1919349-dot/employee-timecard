"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BREAK_MINUTES,
  formatTime,
  getWorkTypeLabel,
  toDatetimeLocalValue,
} from "@/lib/attendance";
import {
  AttendanceLog,
  AttendanceStatus,
  GroupStaffConfig,
  GroupStaffStatus,
  TimecardPayload,
  WorkType,
} from "@/lib/types";

type Props = {
  employeeKey: string | null;
  initialData: TimecardPayload | null;
  initialMessage?: string;
};

type ActivePanel = "home" | "recent" | "monthly" | "pdf";

type MonthlySummary = {
  workedDays: number;
  totalWorkMinutes: number;
  overtimeMinutes: number;
  totalWorkLabel: string;
  overtimeLabel: string;
};

const EMPLOYEE_KEY_STORAGE_KEY = "employee-timecard.employeeKey";
const STAFF_STORAGE_PREFIX = "employee-timecard.selectedStaff.";

export function TimecardApp({ employeeKey, initialData, initialMessage = "" }: Props) {
  const [effectiveEmployeeKey, setEffectiveEmployeeKey] = useState(employeeKey);
  const [data, setData] = useState<TimecardPayload | null>(initialData);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(
    initialData?.selectedStaff?.id ? [initialData.selectedStaff.id] : [],
  );
  const [workType, setWorkType] = useState<WorkType>(
    initialData?.todayLog?.work_type ?? "normal",
  );
  const [breakFlag, setBreakFlag] = useState(initialData?.todayLog?.break_flag ?? true);
  const [clockOutBreakFlag, setClockOutBreakFlag] = useState(
    initialData?.todayLog?.break_flag ?? true,
  );
  const [selectedMonth, setSelectedMonth] = useState(
    initialData?.businessDate.slice(0, 7) ?? "",
  );
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceLog[]>([]);
  const [clockInEdit, setClockInEdit] = useState("");
  const [clockOutEdit, setClockOutEdit] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>("home");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [showModal, setShowModal] = useState(false);
  const [employeeKeyChecked, setEmployeeKeyChecked] = useState(Boolean(employeeKey));

  const groupStaff = data?.groupStaff ?? null;
  const isGroupMode = Boolean(groupStaff?.length);
  const primaryStaffId = selectedStaffIds[0] ?? null;
  const selectedStaff = useMemo(
    () => groupStaff?.find((staff) => staff.id === primaryStaffId) ?? data?.selectedStaff ?? null,
    [data?.selectedStaff, groupStaff, primaryStaffId],
  );
  const staffReady = !isGroupMode || Boolean(selectedStaff);
  const canClockIn = staffReady && data?.status === "not_clocked_in";
  const canClockOut = staffReady && data?.status === "working";
  const todayLog = staffReady ? data?.todayLog ?? null : null;
  const displayNow = mounted && now ? now : null;
  const currentMonth = data?.businessDate.slice(0, 7) ?? selectedMonth;
  const displayName = isGroupMode
    ? selectedStaff?.name ?? "スタッフを選択"
    : data?.member.name ?? "読み込み中";
  const status = staffReady ? data?.status ?? "not_clocked_in" : "not_clocked_in";
  const statusView = getStatusView(status);
  const todayWorkMinutes = useMemo(
    () => getTodayWorkMinutes(todayLog, staffReady ? data?.status : undefined, displayNow),
    [todayLog, staffReady, data?.status, displayNow],
  );
  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(data?.availableMonths ?? []),
          data?.businessDate.slice(0, 7) ?? "",
          selectedMonth,
        ]),
      ).filter(Boolean),
    [data?.availableMonths, data?.businessDate, selectedMonth],
  );
  const pdfUrl = useMemo(() => {
    if (!effectiveEmployeeKey || !selectedMonth || !staffReady) return "";
    const params = new URLSearchParams({ k: effectiveEmployeeKey, month: selectedMonth });
    if (isGroupMode && selectedStaff?.id) params.set("staffId", selectedStaff.id);
    return `/api/pdf?${params.toString()}`;
  }, [effectiveEmployeeKey, isGroupMode, selectedMonth, selectedStaff?.id, staffReady]);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      setMounted(true);
      setNow(new Date());
    }, 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearInterval(timer);
    };
  }, []);

  const fetchTimecardData = useCallback(async (key: string, staffId?: string | null) => {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({ k: key });
      if (staffId) params.set("staffId", staffId);
      const response = await fetch(`/api/timecard?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);
      applyPayload(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get("k")?.trim() ?? "";
    const providedKey = urlKey || employeeKey || "";
    const storedKey = window.localStorage.getItem(EMPLOYEE_KEY_STORAGE_KEY)?.trim() ?? "";
    const nextKey = providedKey || storedKey;

    if (providedKey) {
      window.localStorage.setItem(EMPLOYEE_KEY_STORAGE_KEY, providedKey);
    }

    if (!nextKey) {
      queueMicrotask(() => {
        setEffectiveEmployeeKey(null);
        setData(null);
        setMessage("社員専用URLから開いてください。");
        setEmployeeKeyChecked(true);
      });
      return;
    }

    queueMicrotask(() => {
      setEffectiveEmployeeKey(nextKey);
      setEmployeeKeyChecked(true);
    });

    if (!initialData || nextKey !== employeeKey) {
      queueMicrotask(() => void fetchTimecardData(nextKey));
    }
  }, [employeeKey, fetchTimecardData, initialData]);

  useEffect(() => {
    if (!effectiveEmployeeKey || !data?.groupStaff?.length) return;
    if (selectedStaffIds.length) return;

    const storedStaffId = window.localStorage.getItem(
      `${STAFF_STORAGE_PREFIX}${effectiveEmployeeKey}`,
    );
    const staffExists = data.groupStaff.some((staff) => staff.id === storedStaffId);

    if (storedStaffId && staffExists) {
      queueMicrotask(() => setSelectedStaffIds([storedStaffId]));
      queueMicrotask(() => void fetchTimecardData(effectiveEmployeeKey, storedStaffId));
    }
  }, [data?.groupStaff, effectiveEmployeeKey, fetchTimecardData, selectedStaffIds.length]);

  useEffect(() => {
    if (!effectiveEmployeeKey || !selectedMonth || !staffReady) {
      queueMicrotask(() => {
        setMonthlySummary(null);
        setMonthlyLogs([]);
      });
      return;
    }

    let ignore = false;
    const params = new URLSearchParams({
      k: effectiveEmployeeKey,
      month: selectedMonth,
    });
    if (isGroupMode && selectedStaff?.id) params.set("staffId", selectedStaff.id);

    queueMicrotask(() => {
      setSummaryLoading(true);

      Promise.all([
        fetch(`/api/monthly-summary?${params.toString()}`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message);
          return payload as MonthlySummary;
        }),
        fetch(`/api/monthly-logs?${params.toString()}`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message);
          return payload.logs as AttendanceLog[];
        }),
      ])
        .then(([summary, logs]) => {
          if (ignore) return;
          setMonthlySummary(summary);
          setMonthlyLogs(logs);
        })
        .catch((error) => {
          if (!ignore) {
            setMonthlySummary(null);
            setMonthlyLogs([]);
            setMessage(error instanceof Error ? error.message : "月次データの取得に失敗しました。");
          }
        })
        .finally(() => {
          if (!ignore) setSummaryLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [effectiveEmployeeKey, isGroupMode, selectedMonth, selectedStaff?.id, staffReady]);

  const loadData = useCallback(async () => {
    if (!effectiveEmployeeKey) return;
    await fetchTimecardData(effectiveEmployeeKey, isGroupMode ? selectedStaff?.id : null);
  }, [effectiveEmployeeKey, fetchTimecardData, isGroupMode, selectedStaff?.id]);

  function applyPayload(payload: TimecardPayload) {
    setData(payload);
    setWorkType(payload.todayLog?.work_type ?? "normal");
    setBreakFlag(payload.todayLog?.break_flag ?? true);
    setClockOutBreakFlag(payload.todayLog?.break_flag ?? true);
    setSelectedMonth((current) => current || payload.businessDate.slice(0, 7));
    if (payload.selectedStaff?.id) {
      setSelectedStaffIds((current) =>
        current.includes(payload.selectedStaff!.id)
          ? current
          : [payload.selectedStaff!.id, ...current],
      );
    }
  }

  async function selectStaff(staff: GroupStaffConfig) {
    if (!effectiveEmployeeKey) return;
    const nextIds = selectedStaffIds.includes(staff.id)
      ? selectedStaffIds.filter((staffId) => staffId !== staff.id)
      : [staff.id, ...selectedStaffIds];

    setSelectedStaffIds(nextIds);

    if (nextIds[0]) {
      window.localStorage.setItem(`${STAFF_STORAGE_PREFIX}${effectiveEmployeeKey}`, nextIds[0]);
      await fetchTimecardData(effectiveEmployeeKey, nextIds[0]);
    }
  }

  async function handleBulkClockIn() {
    if (!effectiveEmployeeKey || !selectedStaffIds.length) return;

    await postAction("/api/clock-in", {
      employeeKey: effectiveEmployeeKey,
      workType,
      breakFlag,
      staffIds: selectedStaffIds,
    });
  }

  async function handleBulkClockOut() {
    if (!effectiveEmployeeKey || !selectedStaffIds.length) return;

    await postAction("/api/clock-out", {
      employeeKey: effectiveEmployeeKey,
      staffIds: selectedStaffIds,
    });
  }

  async function handleSingleStaffClockOut(staffId: string) {
    if (!effectiveEmployeeKey) return;
    await postAction("/api/clock-out", {
      employeeKey: effectiveEmployeeKey,
      staffId,
    });
  }

  async function handleClockIn() {
    if (!staffReady) return;
    await postAction("/api/clock-in", {
      key: effectiveEmployeeKey,
      workType,
      breakFlag,
      staffId: isGroupMode ? selectedStaff?.id : undefined,
      staffName: isGroupMode ? selectedStaff?.name : undefined,
    });
  }

  function openClockOutModal() {
    if (!data?.todayLog || !staffReady) return;

    const currentOut = new Date().toISOString();
    setClockInEdit(toDatetimeLocalValue(data.todayLog.clock_in));
    setClockOutEdit(toDatetimeLocalValue(currentOut));
    setClockOutBreakFlag(data.todayLog.break_flag);
    setShowModal(true);
  }

  async function handleClockOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction("/api/clock-out", {
      key: effectiveEmployeeKey,
      staffId: isGroupMode ? selectedStaff?.id : undefined,
      clockIn: clockInEdit,
      clockOut: clockOutEdit,
      breakFlag: clockOutBreakFlag,
    });
    setShowModal(false);
  }

  async function postAction(path: string, body: unknown) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);
      applyPayload(payload);
      setMessage(payload.message ?? "打刻を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  if (!employeeKeyChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <Spinner />
          <h1 className="mt-5 text-2xl font-black text-slate-950">勤怠</h1>
          <p className="mt-2 text-base font-semibold text-slate-500">社員キーを確認しています</p>
        </GlassCard>
      </main>
    );
  }

  if (!effectiveEmployeeKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <GlassCard className="w-full max-w-md p-8">
          <p className="text-sm font-bold text-blue-500">Timecard</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">社員キーが必要です</h1>
          <p className="mt-4 text-base leading-7 text-slate-500">
            社員専用URLから開くか、URLに社員キーを指定してください。
          </p>
          {message && <MessageCard message={message} />}
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 pb-28 pt-5 text-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        {activePanel === "home" && (
          <HomePanel
            displayName={displayName}
            displayNow={displayNow}
            status={status}
            statusView={statusView}
            todayLog={todayLog}
            todayWorkMinutes={todayWorkMinutes}
            staffReady={staffReady}
            canClockIn={canClockIn}
            canClockOut={canClockOut}
            loading={loading}
            workType={workType}
            breakFlag={breakFlag}
            groupStaff={groupStaff}
            staffStatuses={data?.staffStatuses ?? []}
            selectedStaffIds={selectedStaffIds}
            isGroupMode={isGroupMode}
            selectedStaff={selectedStaff}
            message={message}
            onRefresh={loadData}
            onWorkTypeChange={setWorkType}
            onBreakFlagChange={setBreakFlag}
            onClockIn={handleClockIn}
            onClockOut={openClockOutModal}
            onSelectStaff={selectStaff}
            onBulkClockIn={handleBulkClockIn}
            onBulkClockOut={handleBulkClockOut}
            onSingleStaffClockOut={handleSingleStaffClockOut}
          />
        )}

        {activePanel === "recent" && (
          <RecentPanel staffReady={staffReady} logs={data?.recentLogs ?? []} />
        )}

        {activePanel === "monthly" && (
          <MonthlyPanel
            staffReady={staffReady}
            selectedMonth={selectedMonth || currentMonth}
            monthOptions={monthOptions}
            summary={monthlySummary}
            logs={monthlyLogs}
            loading={summaryLoading}
            onMonthChange={setSelectedMonth}
          />
        )}

        {activePanel === "pdf" && (
          <PdfPanel
            staffReady={staffReady}
            selectedMonth={selectedMonth || currentMonth}
            monthOptions={monthOptions}
            pdfUrl={pdfUrl}
            onMonthChange={setSelectedMonth}
          />
        )}
      </div>

      <BottomNav activePanel={activePanel} onChange={setActivePanel} />

      {showModal && (
        <ClockOutModal
          loading={loading}
          clockInEdit={clockInEdit}
          clockOutEdit={clockOutEdit}
          breakFlag={clockOutBreakFlag}
          onClockInEditChange={setClockInEdit}
          onClockOutEditChange={setClockOutEdit}
          onBreakFlagChange={setClockOutBreakFlag}
          onClose={() => setShowModal(false)}
          onSubmit={handleClockOut}
        />
      )}
    </main>
  );
}

function HomePanel({
  displayName,
  displayNow,
  status,
  statusView,
  todayLog,
  todayWorkMinutes,
  staffReady,
  canClockIn,
  canClockOut,
  loading,
  workType,
  breakFlag,
  groupStaff,
  staffStatuses,
  selectedStaffIds,
  isGroupMode,
  selectedStaff,
  message,
  onRefresh,
  onWorkTypeChange,
  onBreakFlagChange,
  onClockIn,
  onClockOut,
  onSelectStaff,
  onBulkClockIn,
  onBulkClockOut,
  onSingleStaffClockOut,
}: {
  displayName: string;
  displayNow: Date | null;
  status: AttendanceStatus;
  statusView: StatusView;
  todayLog: AttendanceLog | null;
  todayWorkMinutes: number;
  staffReady: boolean;
  canClockIn: boolean;
  canClockOut: boolean;
  loading: boolean;
  workType: WorkType;
  breakFlag: boolean;
  groupStaff: GroupStaffConfig[] | null;
  staffStatuses: GroupStaffStatus[];
  selectedStaffIds: string[];
  isGroupMode: boolean;
  selectedStaff: GroupStaffConfig | null;
  message: string;
  onRefresh: () => void;
  onWorkTypeChange: (workType: WorkType) => void;
  onBreakFlagChange: (breakFlag: boolean) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onSelectStaff: (staff: GroupStaffConfig) => void;
  onBulkClockIn: () => void;
  onBulkClockOut: () => void;
  onSingleStaffClockOut: (staffId: string) => void;
}) {
  return (
    <>
      <header className="px-1 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-400">
              {isGroupMode && !selectedStaff ? "スタッフ選択待ち" : displayName}
            </p>
            <p className="mt-4 text-7xl font-black leading-none tracking-normal tabular-nums text-slate-950">
              {displayNow ? formatClockTime(displayNow) : "--:--"}
            </p>
            <p className="mt-3 text-lg font-bold text-slate-500">
              {displayNow ? formatDateLine(displayNow) : "----年--月--日"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || (isGroupMode && !selectedStaff)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-700 shadow-sm transition active:scale-95 disabled:opacity-40"
            aria-label="更新"
          >
            {loading ? <Spinner compact /> : "↻"}
          </button>
        </div>
      </header>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-base font-black ${statusView.text}`}>
              <span className="mr-2">{status === "not_clocked_in" ? "○" : "●"}</span>
              {staffReady ? statusView.label : "スタッフ未選択"}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {todayLog?.clock_in ? `出勤 ${formatTime(todayLog.clock_in)}` : "まだ出勤していません"}
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-black ${statusView.badge}`}>
            {statusView.shortLabel}
          </span>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <p className="text-base font-black text-slate-500">本日の勤務時間</p>
        <p className="mt-3 text-5xl font-black tracking-normal text-slate-950">
          {formatDurationLong(todayWorkMinutes)}
        </p>
        <p className="mt-4 text-sm font-bold text-slate-400">
          {status === "working" ? "リアルタイムで更新中" : "実打刻ベースで表示"}
        </p>
      </GlassCard>

      <button
        type="button"
        disabled={loading || !staffReady || (!canClockIn && !canClockOut)}
        onClick={canClockIn ? onClockIn : onClockOut}
        className={`h-24 rounded-[32px] text-3xl font-black text-white shadow-sm transition active:scale-[0.98] disabled:bg-slate-300 ${statusView.action}`}
      >
        {loading ? <Spinner light /> : getActionLabel(staffReady, canClockIn, canClockOut)}
      </button>

      <GlassCard className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm font-black text-slate-500">
            勤務区分
            <select
              value={workType}
              disabled={!canClockIn}
              onChange={(event) => onWorkTypeChange(event.target.value as WorkType)}
              className="h-14 rounded-3xl border border-white/70 bg-white/80 px-4 text-base font-black text-slate-900 outline-none shadow-sm disabled:text-slate-400"
            >
              <option value="normal">通常勤務</option>
              <option value="kitchen_car">キッチンカー</option>
            </select>
          </label>
          <BreakToggle
            label="休憩設定"
            value={breakFlag}
            disabled={!canClockIn}
            onChange={onBreakFlagChange}
          />
        </div>
      </GlassCard>

      {isGroupMode && groupStaff && (
        <GroupStaffPanel
          staffList={groupStaff}
          staffStatuses={staffStatuses}
          selectedStaffIds={selectedStaffIds}
          loading={loading}
          onSelect={onSelectStaff}
          onBulkClockIn={onBulkClockIn}
          onBulkClockOut={onBulkClockOut}
          onSingleClockOut={onSingleStaffClockOut}
        />
      )}

      {message && <MessageCard message={message} />}
    </>
  );
}

function GroupStaffPanel({
  staffList,
  staffStatuses,
  selectedStaffIds,
  loading,
  onSelect,
  onBulkClockIn,
  onBulkClockOut,
  onSingleClockOut,
}: {
  staffList: GroupStaffConfig[];
  staffStatuses: GroupStaffStatus[];
  selectedStaffIds: string[];
  loading: boolean;
  onSelect: (staff: GroupStaffConfig) => void;
  onBulkClockIn: () => void;
  onBulkClockOut: () => void;
  onSingleClockOut: (staffId: string) => void;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">スタッフ</h2>
        <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-black text-slate-500">
          {selectedStaffIds.length}名
        </span>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {staffList.map((staff) => {
          const status =
            staffStatuses.find((item) => item.id === staff.id) ?? {
              ...staff,
              status: "not_clocked_in" as AttendanceStatus,
              clockIn: null,
              clockOut: null,
            };

          return (
            <StaffPill
              key={staff.id}
              staff={status}
              selected={selectedStaffIds.includes(staff.id)}
              disabled={loading}
              onSelect={() => onSelect(staff)}
              onClockOut={() => onSingleClockOut(staff.id)}
            />
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={loading || selectedStaffIds.length === 0}
          onClick={onBulkClockIn}
          className="h-14 rounded-3xl bg-blue-600 text-base font-black text-white shadow-sm transition active:scale-95 disabled:bg-slate-300"
        >
          一括出勤
        </button>
        <button
          type="button"
          disabled={loading || selectedStaffIds.length === 0}
          onClick={onBulkClockOut}
          className="h-14 rounded-3xl bg-red-500 text-base font-black text-white shadow-sm transition active:scale-95 disabled:bg-slate-300"
        >
          一括退勤
        </button>
      </div>
    </GlassCard>
  );
}

function StaffPill({
  staff,
  selected,
  disabled,
  onSelect,
  onClockOut,
}: {
  staff: GroupStaffStatus;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClockOut: () => void;
}) {
  const view = getStatusView(staff.status);
  const time =
    staff.status === "working"
      ? formatTime(staff.clockIn)
      : staff.status === "clocked_out"
        ? formatTime(staff.clockOut)
        : "--:--";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className={`min-w-[148px] rounded-[28px] border p-4 shadow-sm transition active:scale-[0.98] ${
        selected ? "border-blue-500 bg-blue-50" : "border-white/80 bg-white/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-black">{staff.name}</p>
        <span className={`h-3 w-3 rounded-full ${view.dot}`} />
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums">{time}</p>
      <p className={`mt-2 text-sm font-black ${view.text}`}>{view.label}</p>
      {staff.status === "working" && (
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClockOut();
          }}
          className="mt-4 h-10 w-full rounded-full bg-red-500 text-sm font-black text-white disabled:bg-slate-300"
        >
          退勤
        </button>
      )}
    </article>
  );
}

function RecentPanel({ staffReady, logs }: { staffReady: boolean; logs: AttendanceLog[] }) {
  return (
    <>
      <ScreenTitle icon="◷" title="実績" subtitle="最近の打刻" />
      {!staffReady ? (
        <EmptyStaffNotice />
      ) : (
        <div className="flex flex-col gap-3">
          {logs.length ? (
            logs.map((log) => <RecentLogCard key={log.id} log={log} />)
          ) : (
            <EmptyState message="表示できる打刻記録はまだありません。" />
          )}
        </div>
      )}
    </>
  );
}

function MonthlyPanel({
  staffReady,
  selectedMonth,
  monthOptions,
  summary,
  logs,
  loading,
  onMonthChange,
}: {
  staffReady: boolean;
  selectedMonth: string;
  monthOptions: string[];
  summary: MonthlySummary | null;
  logs: AttendanceLog[];
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  return (
    <>
      <ScreenTitle icon="▦" title="月次" subtitle="ひと月のまとめ" />
      <MonthSelect
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        disabled={!staffReady}
        onMonthChange={onMonthChange}
      />
      {staffReady ? (
        <>
          <GlassCard className="p-6">
            <p className="text-base font-black text-slate-500">{formatMonthLabel(selectedMonth)}</p>
            <p className="mt-3 text-5xl font-black text-slate-950">
              {loading ? "..." : formatDurationLong(summary?.totalWorkMinutes ?? 0)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <SummaryTile label="残業" value={loading ? "..." : formatDurationLong(summary?.overtimeMinutes ?? 0)} />
              <SummaryTile label="出勤日数" value={loading ? "..." : `${summary?.workedDays ?? 0}日`} />
            </div>
          </GlassCard>
          <div className="flex flex-col gap-3">
            {logs.length ? (
              logs.map((log) => <MonthlyLogCard key={log.id} log={log} />)
            ) : (
              <EmptyState message="この月の打刻記録はありません。" />
            )}
          </div>
        </>
      ) : (
        <EmptyStaffNotice />
      )}
    </>
  );
}

function PdfPanel({
  staffReady,
  selectedMonth,
  monthOptions,
  pdfUrl,
  onMonthChange,
}: {
  staffReady: boolean;
  selectedMonth: string;
  monthOptions: string[];
  pdfUrl: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <>
      <ScreenTitle icon="↓" title="PDF" subtitle="月別勤怠を出力" />
      <GlassCard className="p-6">
        <MonthSelect
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          disabled={!staffReady}
          onMonthChange={onMonthChange}
        />
        <a
          href={pdfUrl || undefined}
          aria-disabled={!pdfUrl}
          className={`mt-6 flex h-20 w-full items-center justify-center rounded-[32px] text-2xl font-black shadow-sm transition active:scale-[0.98] ${
            pdfUrl ? "bg-slate-950 text-white" : "pointer-events-none bg-slate-200 text-slate-400"
          }`}
        >
          PDFを出力
        </a>
      </GlassCard>
      <GlassCard className="p-5">
        <p className="text-sm font-black text-slate-400">今後の拡張</p>
        <div className="mt-4 grid gap-3">
          <ExportOption label="PDF種類追加" />
          <ExportOption label="CSV出力" />
          <ExportOption label="給与連携" />
        </div>
      </GlassCard>
    </>
  );
}

function BottomNav({
  activePanel,
  onChange,
}: {
  activePanel: ActivePanel;
  onChange: (panel: ActivePanel) => void;
}) {
  const tabs: { id: ActivePanel; label: string; icon: string }[] = [
    { id: "home", label: "ホーム", icon: "⌂" },
    { id: "recent", label: "実績", icon: "◷" },
    { id: "monthly", label: "月次", icon: "▦" },
    { id: "pdf", label: "PDF", icon: "↓" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/80 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex h-16 flex-col items-center justify-center rounded-3xl text-xs font-black transition ${
                active ? "bg-slate-950 text-white shadow-sm" : "text-slate-400"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ClockOutModal({
  loading,
  clockInEdit,
  clockOutEdit,
  breakFlag,
  onClockInEditChange,
  onClockOutEditChange,
  onBreakFlagChange,
  onClose,
  onSubmit,
}: {
  loading: boolean;
  clockInEdit: string;
  clockOutEdit: string;
  breakFlag: boolean;
  onClockInEditChange: (value: string) => void;
  onClockOutEditChange: (value: string) => void;
  onBreakFlagChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/35 px-4 py-5 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-md animate-slide-up rounded-[32px] bg-white/95 p-6 shadow-2xl backdrop-blur-xl"
      >
        <h2 className="text-2xl font-black">退勤前の確認</h2>
        <p className="mt-2 text-base leading-7 text-slate-500">
          必要な場合は時刻と休憩設定を調整してください。
        </p>
        <div className="mt-6 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-black text-slate-500">
            出勤時刻
            <input
              type="datetime-local"
              value={clockInEdit}
              onChange={(event) => onClockInEditChange(event.target.value)}
              className="h-14 rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none focus:border-blue-400"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-black text-slate-500">
            退勤時刻
            <input
              type="datetime-local"
              value={clockOutEdit}
              onChange={(event) => onClockOutEditChange(event.target.value)}
              className="h-14 rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none focus:border-blue-400"
              required
            />
          </label>
          <BreakToggle label="休憩設定" value={breakFlag} onChange={onBreakFlagChange} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-3xl bg-slate-100 text-base font-black text-slate-700 transition active:scale-95"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-14 rounded-3xl bg-red-500 text-base font-black text-white shadow-sm transition active:scale-95 disabled:bg-slate-300"
          >
            退勤する
          </button>
        </div>
      </form>
    </div>
  );
}

function RecentLogCard({ log }: { log: AttendanceLog }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-black">{formatShortDate(log.date)}</p>
          <p className="mt-2 text-lg font-bold text-slate-500">{formatTimeRange(log)}</p>
        </div>
        <p className="text-2xl font-black tabular-nums">{formatDurationLong(log.work_minutes ?? 0)}</p>
      </div>
    </GlassCard>
  );
}

function MonthlyLogCard({ log }: { log: AttendanceLog }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-black">{formatShortDate(log.date)}</p>
          <p className="mt-2 text-base font-bold text-slate-500">{formatTimeRange(log)}</p>
          <p className="mt-2 text-sm font-black text-slate-400">
            {getWorkTypeLabel(log.work_type)} / {log.break_flag ? "休憩あり" : "休憩なし"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black">{formatDurationLong(log.work_minutes ?? 0)}</p>
          <p className="mt-1 text-sm font-black text-rose-500">
            残業 {formatDurationLong(log.overtime_minutes ?? 0)}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function MonthSelect({
  selectedMonth,
  monthOptions,
  disabled,
  onMonthChange,
}: {
  selectedMonth: string;
  monthOptions: string[];
  disabled: boolean;
  onMonthChange: (month: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-black text-slate-500">
      月選択
      <select
        value={selectedMonth}
        disabled={disabled}
        onChange={(event) => onMonthChange(event.target.value)}
        className="h-14 rounded-3xl border border-slate-200 bg-white px-4 text-lg font-black text-slate-950 outline-none shadow-sm disabled:text-slate-400"
      >
        {monthOptions.map((month) => (
          <option key={month} value={month}>
            {month}
          </option>
        ))}
      </select>
    </label>
  );
}

function BreakToggle({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-black text-slate-500">
      {label}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`h-14 rounded-3xl px-4 text-base font-black shadow-sm transition active:scale-95 disabled:opacity-50 ${
          value ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {value ? "1時間あり" : "なし"}
      </button>
    </label>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[32px] border border-white/80 bg-slate-50/80 shadow-sm backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}

function ScreenTitle({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="px-1 pt-2">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl font-black">
          {icon}
        </span>
        <div>
          <h1 className="text-4xl font-black tracking-normal">{title}</h1>
          <p className="mt-1 text-base font-bold text-slate-400">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
      <p className="text-sm font-black text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ExportOption({ label }: { label: string }) {
  return (
    <div className="flex h-14 items-center justify-between rounded-3xl bg-white/80 px-4 shadow-sm">
      <span className="text-base font-black text-slate-600">{label}</span>
      <span className="text-xl font-black text-slate-300">+</span>
    </div>
  );
}

function EmptyStaffNotice() {
  return <EmptyState message="スタッフを選択すると表示されます。" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <GlassCard className="p-6 text-center">
      <p className="text-base font-bold text-slate-400">{message}</p>
    </GlassCard>
  );
}

function MessageCard({ message }: { message: string }) {
  return (
    <p className="rounded-3xl bg-blue-50 px-5 py-4 text-base font-bold leading-7 text-blue-800">
      {message}
    </p>
  );
}

function Spinner({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${
        light ? "text-white" : "text-blue-600"
      } ${compact ? "h-5 w-5" : "h-7 w-7"}`}
      aria-label="読み込み中"
    />
  );
}

type StatusView = ReturnType<typeof getStatusView>;

function getStatusView(status: AttendanceStatus) {
  const views = {
    not_clocked_in: {
      label: "未出勤",
      shortLabel: "待機",
      badge: "bg-slate-100 text-slate-500",
      text: "text-slate-500",
      dot: "bg-slate-300",
      action: "bg-blue-600",
    },
    working: {
      label: "勤務中",
      shortLabel: "勤務中",
      badge: "bg-blue-100 text-blue-700",
      text: "text-blue-700",
      dot: "bg-blue-600",
      action: "bg-red-500",
    },
    clocked_out: {
      label: "退勤済み",
      shortLabel: "完了",
      badge: "bg-emerald-100 text-emerald-700",
      text: "text-emerald-700",
      dot: "bg-emerald-600",
      action: "bg-emerald-600",
    },
  } satisfies Record<AttendanceStatus, Record<string, string>>;

  return views[status];
}

function getActionLabel(staffReady: boolean, canClockIn: boolean, canClockOut: boolean) {
  if (!staffReady) return "スタッフを選択";
  if (canClockIn) return "出勤";
  if (canClockOut) return "退勤";
  return "本日は完了";
}

function getTodayWorkMinutes(
  log: TimecardPayload["todayLog"],
  status: AttendanceStatus | undefined,
  now: Date | null,
) {
  if (!log?.clock_in) return 0;
  if (typeof log.work_minutes === "number" && status === "clocked_out") return log.work_minutes;

  const end = log.clock_out ? new Date(log.clock_out) : now;
  if (!end) return 0;

  const rawMinutes = Math.floor((end.getTime() - new Date(log.clock_in).getTime()) / 60000);
  return Math.max(0, rawMinutes - (log.break_flag ? BREAK_MINUTES : 0));
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateLine(date: Date) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

function formatDurationLong(minutes: number) {
  if (!minutes || minutes <= 0) return "0分";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}分`;
  if (rest <= 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function formatShortDate(dateKey: string) {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}`;
}

function formatTimeRange(log: AttendanceLog) {
  return `${formatTime(log.clock_in)}〜${formatTime(log.clock_out)}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return `${year}年${monthNumber}月`;
}
