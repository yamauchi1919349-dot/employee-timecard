"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BASIC_WORK_MINUTES,
  BREAK_MINUTES,
  formatLocalDateTime,
  formatMinutes,
  formatTime,
  getWorkTypeLabel,
  toDatetimeLocalValue,
} from "@/lib/attendance";
import {
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
  const [selectedMonth, setSelectedMonth] = useState(
    initialData?.businessDate.slice(0, 7) ?? "",
  );
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [clockInEdit, setClockInEdit] = useState("");
  const [clockOutEdit, setClockOutEdit] = useState("");
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

  const statusView = getStatusView(staffReady ? data?.status ?? "not_clocked_in" : "not_clocked_in");
  const todayWorkMinutes = useMemo(
    () => getTodayWorkMinutes(todayLog, staffReady ? data?.status : undefined, displayNow),
    [todayLog, staffReady, data?.status, displayNow],
  );
  const todayBreakMinutes = todayLog?.break_flag ?? breakFlag ? BREAK_MINUTES : 0;
  const remainingMinutes = Math.max(0, BASIC_WORK_MINUTES - todayWorkMinutes);
  const targetReached = todayWorkMinutes >= BASIC_WORK_MINUTES;
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
      setEffectiveEmployeeKey(null);
      setData(null);
      setMessage("Safariで社員専用URLを開いてからホーム画面に追加してください。");
      setEmployeeKeyChecked(true);
      return;
    }

    setEffectiveEmployeeKey(nextKey);
    setEmployeeKeyChecked(true);

    if (!initialData || nextKey !== employeeKey) {
      void fetchTimecardData(nextKey);
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
      setSelectedStaffIds([storedStaffId]);
      void fetchTimecardData(effectiveEmployeeKey, storedStaffId);
    }
  }, [data?.groupStaff, effectiveEmployeeKey, fetchTimecardData, selectedStaffIds.length]);

  useEffect(() => {
    if (!effectiveEmployeeKey || !selectedMonth || !staffReady) {
      setMonthlySummary(null);
      return;
    }

    let ignore = false;
    setSummaryLoading(true);

    const params = new URLSearchParams({
      k: effectiveEmployeeKey,
      month: selectedMonth,
    });
    if (isGroupMode && selectedStaff?.id) params.set("staffId", selectedStaff.id);

    fetch(`/api/monthly-summary?${params.toString()}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        if (!ignore) setMonthlySummary(payload);
      })
      .catch((error) => {
        if (!ignore) {
          setMonthlySummary(null);
          setMessage(error instanceof Error ? error.message : "月間サマリーの取得に失敗しました。");
        }
      })
      .finally(() => {
        if (!ignore) setSummaryLoading(false);
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
    setShowModal(true);
  }

  async function handleClockOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction("/api/clock-out", {
      key: effectiveEmployeeKey,
      staffId: isGroupMode ? selectedStaff?.id : undefined,
      clockIn: clockInEdit,
      clockOut: clockOutEdit,
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
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <section className="app-card w-full max-w-md p-7 text-center">
          <Spinner />
          <h1 className="mt-4 text-xl font-bold text-slate-950">勤怠アプリ</h1>
          <p className="mt-2 text-sm text-slate-500">社員キーを確認しています。</p>
        </section>
      </main>
    );
  }

  if (!effectiveEmployeeKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
        <section className="app-card w-full max-w-md p-7">
          <p className="text-sm font-semibold text-blue-600">タイムカード</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">社員キーが必要です</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Safariで社員専用URLを開いてからホーム画面に追加してください。
          </p>
          {message && (
            <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 pb-8 pt-5 text-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="animate-fade-in px-1 pt-2">
          <p className="text-lg font-bold text-slate-950">おはようございます ☀️</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">
            {isGroupMode && !selectedStaff ? displayName : `${displayName}さん`}
          </h1>
          <p className="mt-4 text-sm font-bold text-slate-500">本日の勤務状況</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-6xl font-black leading-none tracking-normal tabular-nums">
                {displayNow
                  ? displayNow.toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {displayNow ? formatDateLine(displayNow) : "----/--/--"}
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading || (isGroupMode && !selectedStaff)}
              className="h-12 w-12 shrink-0 rounded-full bg-white text-lg font-black text-slate-700 shadow-sm transition active:scale-95 disabled:opacity-50"
              aria-label="更新"
            >
              {loading ? <Spinner compact /> : "↻"}
            </button>
          </div>
        </header>

        {isGroupMode && groupStaff && (
          <section className="app-card animate-fade-in p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">スタッフ選択</h2>
              <span className="text-xs font-bold text-slate-400">
                {selectedStaffIds.length}名選択中
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {groupStaff.map((staff) => {
                const status =
                  data?.staffStatuses.find((item) => item.id === staff.id) ?? {
                    ...staff,
                    status: "not_clocked_in" as AttendanceStatus,
                    clockIn: null,
                    clockOut: null,
                  };
                return (
                  <StaffCard
                    key={staff.id}
                    staff={status}
                    selected={selectedStaffIds.includes(staff.id)}
                    onSelect={() => void selectStaff(staff)}
                    onClockOut={() => void handleSingleStaffClockOut(staff.id)}
                    disabled={loading}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading || selectedStaffIds.length === 0}
                onClick={handleBulkClockIn}
                className="h-12 rounded-full bg-blue-600 text-sm font-black text-white shadow-md shadow-blue-100 transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                選択したスタッフを出勤
              </button>
              <button
                type="button"
                disabled={loading || selectedStaffIds.length === 0}
                onClick={handleBulkClockOut}
                className="h-12 rounded-full bg-red-500 text-sm font-black text-white shadow-md shadow-red-100 transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                選択したスタッフを退勤
              </button>
            </div>
          </section>
        )}

        <section className={`app-card animate-fade-in p-6 ${statusView.ring}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`rounded-full px-4 py-2 text-sm font-black ${statusView.badge}`}>
              {staffReady ? statusView.label : "スタッフ未選択"}
            </span>
            {targetReached && (
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                目標達成！
              </span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric label="出勤" value={formatTime(todayLog?.clock_in ?? null)} />
            <Metric
              label={data?.status === "clocked_out" ? "勤務時間" : "経過時間"}
              value={formatMinutes(todayWorkMinutes)}
            />
          </div>

          <div className={`mt-5 rounded-3xl px-5 py-4 ${statusView.panel}`}>
            <p className="text-sm font-bold opacity-80">現在の状態</p>
            <p className="mt-1 text-3xl font-black tracking-normal">
              {staffReady ? statusView.label : "スタッフを選択"}
            </p>
          </div>
        </section>

        <section className="app-card animate-fade-in p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm font-black text-slate-700">
              勤務区分
              <select
                value={workType}
                disabled={!canClockIn}
                onChange={(event) => setWorkType(event.target.value as WorkType)}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold outline-none transition focus:border-blue-400 disabled:text-slate-400"
              >
                <option value="normal">通常勤務</option>
                <option value="kitchen_car">キッチンカー</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-black text-slate-700">
              休憩
              <button
                type="button"
                disabled={!canClockIn}
                onClick={() => setBreakFlag((current) => !current)}
                className={`h-12 rounded-2xl px-4 text-base font-black transition active:scale-95 disabled:opacity-60 ${
                  breakFlag ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {breakFlag ? "1:00 あり" : "なし"}
              </button>
            </label>
          </div>

          <button
            type="button"
            disabled={loading || !staffReady || (!canClockIn && !canClockOut)}
            onClick={canClockIn ? handleClockIn : openClockOutModal}
            className={`mt-5 flex h-[68px] w-full items-center justify-center rounded-full text-xl font-black text-white shadow-lg transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none ${statusView.action}`}
          >
            {loading ? (
              <Spinner light />
            ) : !staffReady ? (
              "スタッフを選択"
            ) : canClockIn ? (
              "▶ 出勤"
            ) : canClockOut ? (
              "■ 退勤"
            ) : (
              "✓ 本日は完了"
            )}
          </button>

          {message && (
            <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              {message}
            </p>
          )}
        </section>

        <section className="app-card animate-fade-in p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">本日の実績</h2>
            {staffReady && data?.status === "clocked_out" && (
              <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600">
                本日もお疲れ様でした 🎉
              </span>
            )}
          </div>
          {staffReady ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard label="勤務時間" value={formatMinutes(todayWorkMinutes)} />
              <StatCard label="休憩" value={formatMinutes(todayBreakMinutes)} />
              <StatCard label="残り" value={formatMinutes(remainingMinutes)} />
            </div>
          ) : (
            <EmptyStaffNotice />
          )}
        </section>

        <section className="app-card animate-fade-in p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">今月の勤務</h2>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {selectedMonth || currentMonth}
              </p>
            </div>
            <select
              value={selectedMonth}
              disabled={!staffReady}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-10 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-black outline-none disabled:text-slate-400"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          {staffReady ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard
                label="勤務日数"
                value={summaryLoading ? "..." : `${monthlySummary?.workedDays ?? 0}日`}
                accent="blue"
              />
              <StatCard
                label="総勤務時間"
                value={
                  summaryLoading
                    ? "..."
                    : formatHourLabel(monthlySummary?.totalWorkMinutes ?? 0)
                }
                accent="slate"
              />
              <StatCard
                label="残業"
                value={
                  summaryLoading ? "..." : formatHourLabel(monthlySummary?.overtimeMinutes ?? 0)
                }
                accent="rose"
              />
            </div>
          ) : (
            <EmptyStaffNotice />
          )}
        </section>

        <section className="app-card animate-fade-in p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">最近の記録</h2>
            <span className="text-xs font-bold text-slate-400">直近3日</span>
          </div>
          {!staffReady ? (
            <EmptyStaffNotice />
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {data?.recentLogs.length ? (
                data.recentLogs.map((log) => (
                  <article key={log.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{log.date}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {getWorkTypeLabel(log.work_type)} /{" "}
                        {log.break_flag ? "休憩あり" : "休憩なし"}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600">
                      <p>出勤 {formatLocalDateTime(log.clock_in)}</p>
                      <p>退勤 {formatLocalDateTime(log.clock_out)}</p>
                      <p>勤務 {formatMinutes(log.work_minutes)}</p>
                      <p>残業 {formatMinutes(log.overtime_minutes)}</p>
                    </div>
                    {log.note && <p className="mt-3 text-sm text-slate-500">{log.note}</p>}
                  </article>
                ))
              ) : (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  表示できる打刻記録はまだありません。
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-10 flex items-end bg-slate-950/45 px-4 py-5 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={handleClockOut}
            className="mx-auto w-full max-w-md animate-slide-up rounded-[28px] bg-white p-5 shadow-2xl"
          >
            <h2 className="text-xl font-black">退勤前の確認</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              必要な場合だけ時刻を修正してください。修正内容は履歴に残ります。
            </p>
            <div className="mt-5 grid gap-3">
              <label className="flex flex-col gap-2 text-sm font-black text-slate-700">
                出勤時刻
                <input
                  type="datetime-local"
                  value={clockInEdit}
                  onChange={(event) => setClockInEdit(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-blue-400"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-black text-slate-700">
                退勤時刻
                <input
                  type="datetime-local"
                  value={clockOutEdit}
                  onChange={(event) => setClockOutEdit(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-blue-400"
                  required
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-13 rounded-full border border-slate-200 font-black text-slate-700 transition active:scale-95"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-13 rounded-full bg-red-500 font-black text-white shadow-lg transition active:scale-95 disabled:bg-slate-300"
              >
                退勤する
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function StaffCard({
  staff,
  selected,
  onSelect,
  onClockOut,
  disabled,
}: {
  staff: GroupStaffStatus;
  selected: boolean;
  onSelect: () => void;
  onClockOut: () => void;
  disabled: boolean;
}) {
  const view = getStatusView(staff.status);
  const time =
    staff.status === "working"
      ? formatTime(staff.clockIn)
      : staff.status === "clocked_out"
        ? formatTime(staff.clockOut)
        : "未出勤";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-3xl border p-4 text-left transition active:scale-[0.98] ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
          : "border-transparent bg-slate-50"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full border text-xs font-black ${
              selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-transparent"
            }`}
          >
            ✓
          </span>
          <p className="text-lg font-black text-slate-950">{staff.name}</p>
        </div>
        <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${view.badge}`}>
          {view.label}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-xl font-black tracking-normal text-slate-950 tabular-nums">{time}</p>
        {staff.status === "working" && (
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onClockOut();
            }}
            className={`rounded-full px-4 py-2 text-xs font-black text-white transition active:scale-95 ${
              disabled ? "bg-slate-300" : "bg-red-500"
            }`}
          >
            退勤
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyStaffNotice() {
  return (
    <p className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
      スタッフを選択すると表示されます。
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-normal text-slate-950 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "blue" | "rose" | "slate";
}) {
  const accentClass = {
    blue: "text-blue-600 bg-blue-50",
    rose: "text-rose-600 bg-rose-50",
    slate: "text-slate-950 bg-slate-50",
  }[accent];

  return (
    <div className={`min-h-[88px] rounded-3xl p-3 ${accentClass}`}>
      <p className="text-[11px] font-black opacity-60">{label}</p>
      <p className="mt-3 text-lg font-black tracking-normal tabular-nums">{value}</p>
    </div>
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

function getStatusView(status: AttendanceStatus) {
  const views = {
    not_clocked_in: {
      label: "未出勤",
      badge: "bg-slate-100 text-slate-600",
      panel: "bg-slate-100 text-slate-700",
      ring: "ring-1 ring-slate-100",
      action: "bg-blue-600 shadow-blue-200",
    },
    working: {
      label: "出勤中",
      badge: "bg-blue-100 text-blue-700",
      panel: "bg-blue-600 text-white",
      ring: "ring-2 ring-blue-100",
      action: "bg-red-500 shadow-red-200",
    },
    clocked_out: {
      label: "退勤済",
      badge: "bg-emerald-100 text-emerald-700",
      panel: "bg-emerald-600 text-white",
      ring: "ring-2 ring-emerald-100",
      action: "bg-emerald-600 shadow-emerald-200",
    },
  } satisfies Record<AttendanceStatus, Record<string, string>>;

  return views[status];
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

function formatDateLine(date: Date) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}(${weekday})`;
}

function formatHourLabel(minutes: number) {
  if (minutes <= 0) return "0時間";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}:${String(rest).padStart(2, "0")}` : `${hours}時間`;
}
