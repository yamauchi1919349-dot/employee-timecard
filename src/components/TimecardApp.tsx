"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatLocalDateTime,
  formatMinutes,
  getStatusLabel,
  getWorkTypeLabel,
  toDatetimeLocalValue,
} from "@/lib/attendance";
import { TimecardPayload, WorkType } from "@/lib/types";

type Props = {
  employeeKey: string | null;
  initialData: TimecardPayload | null;
  initialMessage?: string;
};

export function TimecardApp({ employeeKey, initialData, initialMessage = "" }: Props) {
  const [data, setData] = useState<TimecardPayload | null>(initialData);
  const [workType, setWorkType] = useState<WorkType>(
    initialData?.todayLog?.work_type ?? "normal",
  );
  const [breakFlag, setBreakFlag] = useState(initialData?.todayLog?.break_flag ?? true);
  const [selectedMonth, setSelectedMonth] = useState(
    initialData?.availableMonths[0] ?? initialData?.businessDate.slice(0, 7) ?? "",
  );
  const [clockInEdit, setClockInEdit] = useState("");
  const [clockOutEdit, setClockOutEdit] = useState("");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [showModal, setShowModal] = useState(false);

  const canClockIn = data?.status === "not_clocked_in";
  const canClockOut = data?.status === "working";

  const pdfHref = useMemo(() => {
    if (!employeeKey || !selectedMonth) return "";
    return `/api/pdf?k=${encodeURIComponent(employeeKey)}&month=${selectedMonth}`;
  }, [employeeKey, selectedMonth]);

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

  const loadData = useCallback(async () => {
    if (!employeeKey) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/timecard?k=${encodeURIComponent(employeeKey)}`);
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);
      applyPayload(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [employeeKey]);

  function applyPayload(payload: TimecardPayload) {
    setData(payload);
    setWorkType(payload.todayLog?.work_type ?? "normal");
    setBreakFlag(payload.todayLog?.break_flag ?? true);
    setSelectedMonth((current) => current || payload.availableMonths[0] || payload.businessDate.slice(0, 7));
  }

  async function handleClockIn() {
    await postAction("/api/clock-in", {
      key: employeeKey,
      workType,
      breakFlag,
    });
  }

  function openClockOutModal() {
    if (!data?.todayLog) return;

    const currentOut = new Date().toISOString();
    setClockInEdit(toDatetimeLocalValue(data.todayLog.clock_in));
    setClockOutEdit(toDatetimeLocalValue(currentOut));
    setShowModal(true);
  }

  async function handleClockOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction("/api/clock-out", {
      key: employeeKey,
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
      setMessage("打刻を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  if (!employeeKey) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5">
        <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">社員勤怠管理タイムカード</h1>
          <p className="mt-3 text-sm text-slate-600">
            URLに従業員キーを指定してください。例: /?k=demo-taro
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">社員勤怠管理タイムカード</p>
              <h1 className="mt-1 text-2xl font-bold">
                {data?.member.name ?? "読み込み中"}
              </h1>
            </div>
            <a
              href="/admin"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              管理
            </a>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">現在時刻</p>
            <p className="mt-1 text-5xl font-bold tracking-normal">
              {mounted && now
                ? now.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--:--"}
            </p>
          </div>

          <div className="mt-6 rounded-lg bg-slate-100 p-4 text-center">
            <p className="text-sm text-slate-500">本日の状態</p>
            <p className="mt-1 text-2xl font-bold">
              {data ? getStatusLabel(data.status) : "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              営業日: {data?.businessDate ?? "-"}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
              勤務区分
              <select
                value={workType}
                disabled={!canClockIn}
                onChange={(event) => setWorkType(event.target.value as WorkType)}
                className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base"
              >
                <option value="normal">通常勤務</option>
                <option value="kitchen_car">キッチンカー</option>
              </select>
            </label>
            <label className="flex min-h-12 items-end gap-3 rounded-md border border-slate-300 px-3 py-3 text-base font-semibold">
              <input
                type="checkbox"
                checked={breakFlag}
                disabled={!canClockIn}
                onChange={(event) => setBreakFlag(event.target.checked)}
                className="h-5 w-5"
              />
              休憩あり
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!canClockIn || loading}
              onClick={handleClockIn}
              className="h-16 rounded-lg bg-emerald-600 text-xl font-bold text-white disabled:bg-slate-300"
            >
              出勤
            </button>
            <button
              type="button"
              disabled={!canClockOut || loading}
              onClick={openClockOutModal}
              className="h-16 rounded-lg bg-rose-600 text-xl font-bold text-white disabled:bg-slate-300"
            >
              退勤
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              {message}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">過去3日の打刻記録</h2>
            <button
              type="button"
              onClick={loadData}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
            >
              更新
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {data?.recentLogs.length ? (
              data.recentLogs.map((log) => (
                <article key={log.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{log.date}</p>
                    <p className="text-sm text-slate-600">
                      {getWorkTypeLabel(log.work_type)} / {log.break_flag ? "休憩あり" : "休憩なし"}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p>出勤: {formatLocalDateTime(log.clock_in)}</p>
                    <p>退勤: {formatLocalDateTime(log.clock_out)}</p>
                    <p>労働: {formatMinutes(log.work_minutes)}</p>
                    <p>残業: {formatMinutes(log.overtime_minutes)}</p>
                  </div>
                  {log.note && <p className="mt-2 text-sm text-slate-600">{log.note}</p>}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">表示できる打刻記録はありません。</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">月別PDF出力</h2>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base"
            >
              {Array.from(
                new Set([
                  ...(data?.availableMonths ?? []),
                  data?.businessDate.slice(0, 7) ?? "",
                ]),
              )
                .filter(Boolean)
                .map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
            </select>
            <a
              href={pdfHref || undefined}
              className="flex h-12 items-center rounded-lg bg-orange-500 px-5 font-bold text-white"
            >
              PDF
            </a>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40 px-4 py-5 sm:items-center">
          <form
            onSubmit={handleClockOut}
            className="mx-auto w-full max-w-xl rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-xl font-bold">退勤前確認</h2>
            <p className="mt-2 text-sm text-slate-600">
              必要な場合のみ時刻を修正してください。修正時は備考に履歴が残ります。
            </p>
            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                出勤時刻
                <input
                  type="datetime-local"
                  value={clockInEdit}
                  onChange={(event) => setClockInEdit(event.target.value)}
                  className="h-12 rounded-md border border-slate-300 px-3 text-base"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                退勤時刻
                <input
                  type="datetime-local"
                  value={clockOutEdit}
                  onChange={(event) => setClockOutEdit(event.target.value)}
                  className="h-12 rounded-md border border-slate-300 px-3 text-base"
                  required
                />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-12 rounded-lg border border-slate-300 font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-12 rounded-lg bg-rose-600 font-bold text-white disabled:bg-slate-300"
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
