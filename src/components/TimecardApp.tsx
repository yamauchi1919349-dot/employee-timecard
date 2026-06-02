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
  CalendarDay,
  CalendarDayType,
  GroupStaffConfig,
  GroupStaffStatus,
  PdfEmailRecipient,
  TimecardPayload,
  WorkType,
} from "@/lib/types";

type Props = {
  employeeKey: string | null;
  initialData: TimecardPayload | null;
  initialMessage?: string;
};

type ActivePanel = "home" | "calendar" | "monthly" | "pdf";

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
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [pdfRecipients, setPdfRecipients] = useState<PdfEmailRecipient[]>([]);
  const [pdfEmail, setPdfEmail] = useState("");
  const [pdfEmailLoading, setPdfEmailLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
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

  useEffect(() => {
    if (activePanel !== "calendar") return;

    if (!effectiveEmployeeKey || !selectedMonth || !staffReady) {
      queueMicrotask(() => setCalendarDays([]));
      return;
    }

    let ignore = false;
    const params = new URLSearchParams({
      k: effectiveEmployeeKey,
      month: selectedMonth,
    });
    if (isGroupMode && selectedStaff?.id) params.set("staffId", selectedStaff.id);

    queueMicrotask(() => {
      setCalendarLoading(true);

      fetch(`/api/calendar-days?${params.toString()}`)
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message);
          return payload.days as CalendarDay[];
        })
        .then((days) => {
          if (!ignore) setCalendarDays(days);
        })
        .catch((error) => {
          if (!ignore) {
            setCalendarDays([]);
            setMessage(error instanceof Error ? error.message : "休日設定の取得に失敗しました。");
          }
        })
        .finally(() => {
          if (!ignore) setCalendarLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [
    activePanel,
    effectiveEmployeeKey,
    isGroupMode,
    selectedMonth,
    selectedStaff?.id,
    staffReady,
  ]);

  useEffect(() => {
    if (activePanel !== "pdf") return;

    if (!effectiveEmployeeKey || !staffReady) {
      queueMicrotask(() => setPdfRecipients([]));
      return;
    }

    let ignore = false;
    const params = new URLSearchParams({ k: effectiveEmployeeKey });
    if (isGroupMode && selectedStaff?.id) params.set("staffId", selectedStaff.id);

    queueMicrotask(() => {
      setPdfEmailLoading(true);

      fetch(`/api/pdf-recipients?${params.toString()}`)
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message);
          return payload.recipients as PdfEmailRecipient[];
        })
        .then((recipients) => {
          if (!ignore) setPdfRecipients(recipients);
        })
        .catch((error) => {
          if (!ignore) {
            setPdfRecipients([]);
            setPdfMessage(error instanceof Error ? error.message : "PDF送信先の取得に失敗しました。");
          }
        })
        .finally(() => {
          if (!ignore) setPdfEmailLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [activePanel, effectiveEmployeeKey, isGroupMode, selectedStaff?.id, staffReady]);

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

  async function handleCalendarDayToggle(dateKey: string) {
    if (!effectiveEmployeeKey || !staffReady) return;

    const existing = calendarDays.find((day) => day.date === dateKey);
    const nextDayType: CalendarDayType =
      existing?.day_type === "holiday" ? "workday" : "holiday";

    setCalendarLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/calendar-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          k: effectiveEmployeeKey,
          date: dateKey,
          dayType: nextDayType,
          staffId: isGroupMode ? selectedStaff?.id : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);

      setCalendarDays((current) => {
        const withoutDate = current.filter((day) => day.date !== dateKey);
        return payload.day ? [...withoutDate, payload.day as CalendarDay] : withoutDate;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "休日設定の保存に失敗しました。");
    } finally {
      setCalendarLoading(false);
    }
  }

  async function handleAddPdfRecipient() {
    if (!effectiveEmployeeKey || !pdfEmail.trim()) return;

    setPdfEmailLoading(true);
    setPdfMessage("");

    try {
      const response = await fetch("/api/pdf-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          k: effectiveEmployeeKey,
          email: pdfEmail,
          staffId: isGroupMode ? selectedStaff?.id : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);

      setPdfRecipients((current) => {
        const recipient = payload.recipient as PdfEmailRecipient;
        return [
          ...current.filter((item) => item.id !== recipient.id),
          recipient,
        ];
      });
      setPdfEmail("");
    } catch (error) {
      setPdfMessage(error instanceof Error ? error.message : "PDF送信先の追加に失敗しました。");
    } finally {
      setPdfEmailLoading(false);
    }
  }

  async function handleDeletePdfRecipient(id: string) {
    if (!effectiveEmployeeKey) return;

    setPdfEmailLoading(true);
    setPdfMessage("");

    try {
      const response = await fetch("/api/pdf-recipients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          k: effectiveEmployeeKey,
          id,
          staffId: isGroupMode ? selectedStaff?.id : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);

      setPdfRecipients((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setPdfMessage(error instanceof Error ? error.message : "PDF送信先の削除に失敗しました。");
    } finally {
      setPdfEmailLoading(false);
    }
  }

  async function handleSendPdfEmail() {
    if (!effectiveEmployeeKey || !selectedMonth || !pdfRecipients.length) return;

    setPdfEmailLoading(true);
    setPdfMessage("");

    try {
      const response = await fetch("/api/pdf/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          k: effectiveEmployeeKey,
          month: selectedMonth,
          staffId: isGroupMode ? selectedStaff?.id : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.message);

      setPdfMessage(`${payload.sentTo.length}件の送信先へPDFを送信しました。`);
    } catch (error) {
      setPdfMessage(error instanceof Error ? error.message : "PDFメール送信に失敗しました。");
    } finally {
      setPdfEmailLoading(false);
    }
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
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <Spinner />
          <h1 className="mt-5 text-2xl font-black">勤怠</h1>
          <p className="mt-2 text-base font-semibold text-slate-500 dark:text-slate-400">
            社員キーを確認しています
          </p>
        </GlassCard>
      </main>
    );
  }

  if (!effectiveEmployeeKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
        <GlassCard className="w-full max-w-md p-8">
          <p className="text-sm font-bold text-blue-500">Timecard</p>
          <h1 className="mt-3 text-3xl font-black">社員キーが必要です</h1>
          <p className="mt-4 text-base leading-7 text-slate-500 dark:text-slate-400">
            社員専用URLから開くか、URLに社員キーを指定してください。
          </p>
          {message && <MessageCard message={message} />}
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-5 pb-32 pt-[max(44px,calc(env(safe-area-inset-top)+12px))] text-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
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

        {activePanel === "calendar" && (
          <CalendarPanel
            staffReady={staffReady}
            selectedMonth={selectedMonth || currentMonth}
            calendarDays={calendarDays}
            loading={calendarLoading}
            groupStaff={groupStaff}
            staffStatuses={data?.staffStatuses ?? []}
            selectedStaffIds={selectedStaffIds}
            isGroupMode={isGroupMode}
            selectedStaff={selectedStaff}
            onMonthChange={setSelectedMonth}
            onSelectStaff={selectStaff}
            onToggleDay={handleCalendarDayToggle}
          />
        )}

        {activePanel === "monthly" && (
          <MonthlyPanel
            staffReady={staffReady}
            selectedMonth={selectedMonth || currentMonth}
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
            groupStaff={groupStaff}
            staffStatuses={data?.staffStatuses ?? []}
            selectedStaffIds={selectedStaffIds}
            isGroupMode={isGroupMode}
            recipients={pdfRecipients}
            email={pdfEmail}
            loading={pdfEmailLoading}
            message={pdfMessage}
            onMonthChange={setSelectedMonth}
            onSelectStaff={selectStaff}
            onEmailChange={setPdfEmail}
            onAddRecipient={handleAddPdfRecipient}
            onDeleteRecipient={handleDeletePdfRecipient}
            onSendEmail={handleSendPdfEmail}
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
  const progress = Math.min(100, Math.max(0, (todayWorkMinutes / 480) * 100));
  const visibleMessage = message.trim();

  return (
    <div className="flex animate-fade-in flex-col gap-4">
      <header className="relative px-1 pb-2 pt-5 text-center">
        <div>
          <div>
            <p className="text-sm font-bold text-slate-400">
              {isGroupMode && !selectedStaff ? "スタッフ選択待ち" : displayName}
            </p>
            <p className="mt-5 text-[64px] font-black leading-none tracking-normal text-[#111827] tabular-nums">
              {displayNow ? formatClockTime(displayNow) : "--:--"}
            </p>
            <p className="mt-3 text-xl font-black text-[#6B7280]">
              {displayNow ? formatDateLine(displayNow) : "----年--月--日"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || (isGroupMode && !selectedStaff)}
            className="absolute right-0 top-0 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#6366F1] shadow-sm ring-1 ring-slate-100 transition hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label="更新"
          >
            {loading ? <Spinner compact /> : <Icon name="refresh" className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <GlassCard className={`p-4 ${statusView.statusCard}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`flex items-center gap-2 text-xl font-black ${statusView.text}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${statusView.dot} ${status === "working" ? "animate-pulse" : ""}`} />
              {staffReady ? statusView.label : "スタッフ未選択"}
            </p>
            <p className="mt-5 text-base font-semibold text-[#0F172A]">
              {todayLog?.clock_in ? `出勤 ${formatTime(todayLog.clock_in)}` : "まだ出勤していません"}
            </p>
          </div>
          <span className={`ml-auto grid h-14 w-14 shrink-0 place-items-center rounded-full ${statusView.iconBg}`}>
            <Icon name="clock" className="h-7 w-7" />
          </span>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#64748B]">本日の勤務時間</p>
            <p className="mt-4 text-[32px] font-black leading-tight tracking-normal text-[#0F172A]">
              {formatDurationLong(todayWorkMinutes)}
            </p>
            <p className="mt-4 text-sm font-semibold text-[#64748B]">
              {status === "working" ? "リアルタイムで更新中" : "8時間を目安に表示"}
            </p>
          </div>
          <ProgressRing progress={progress} label={formatDurationLong(todayWorkMinutes)} status={status} />
        </div>
      </GlassCard>

      <button
        type="button"
        disabled={loading || !staffReady || (!canClockIn && !canClockOut)}
        onClick={canClockIn ? onClockIn : onClockOut}
        className={`flex h-20 items-center justify-between gap-3 rounded-2xl px-4 text-left text-white shadow-sm transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-default disabled:translate-y-0 disabled:shadow-sm ${statusView.action}`}
      >
        {loading ? (
          <Spinner light />
        ) : (
          <>
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-white">
                <Icon name={!canClockIn && !canClockOut ? "check" : canClockOut ? "stop" : "play"} className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-bold leading-tight">
                  {getActionLabel(staffReady, canClockIn, canClockOut)}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-white/90">
                  {!canClockIn && !canClockOut ? "おつかれさまでした！" : canClockOut ? "退勤時刻を確認します" : "勤務を開始します"}
                </span>
              </span>
            </span>
            <Icon name="chevronRight" className="h-6 w-6 shrink-0" />
          </>
        )}
      </button>

      <GlassCard className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-3 text-sm font-black text-[#6B7280]">
            <span className="flex items-center gap-2 text-[#6B7280]">
              <Icon name="bag" className="h-5 w-5 text-[#6366F1]" />
              勤務区分
            </span>
            <select
              value={workType}
              disabled={!canClockIn}
              onChange={(event) => onWorkTypeChange(event.target.value as WorkType)}
              className="h-12 rounded-xl border border-slate-100 bg-gray-50 px-4 text-base font-bold text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-[#6366F1]/30 disabled:text-slate-400"
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

      {visibleMessage && <MessageCard message={visibleMessage} />}
    </div>
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
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Icon name="users" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          スタッフ
        </h2>
        <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-black text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">
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
          className="h-14 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:bg-none disabled:bg-slate-300"
        >
          一括出勤
        </button>
        <button
          type="button"
          disabled={loading || selectedStaffIds.length === 0}
          onClick={onBulkClockOut}
          className="h-14 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:bg-none disabled:bg-slate-300"
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
      className={`min-w-[148px] rounded-[28px] border p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
        selected
          ? "border-blue-400 bg-blue-50/90 dark:border-blue-400/60 dark:bg-blue-500/20"
          : "border-white/70 bg-white/70 dark:border-white/10 dark:bg-white/10"
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
          className="mt-4 h-10 w-full rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-black text-white disabled:bg-none disabled:bg-slate-300"
        >
          退勤
        </button>
      )}
    </article>
  );
}

function CalendarPanel({
  staffReady,
  selectedMonth,
  calendarDays,
  loading,
  groupStaff,
  staffStatuses,
  selectedStaffIds,
  isGroupMode,
  selectedStaff,
  onMonthChange,
  onSelectStaff,
  onToggleDay,
}: {
  staffReady: boolean;
  selectedMonth: string;
  calendarDays: CalendarDay[];
  loading: boolean;
  groupStaff: GroupStaffConfig[] | null;
  staffStatuses: GroupStaffStatus[];
  selectedStaffIds: string[];
  isGroupMode: boolean;
  selectedStaff: GroupStaffConfig | null;
  onMonthChange: (month: string) => void;
  onSelectStaff: (staff: GroupStaffConfig) => void;
  onToggleDay: (dateKey: string) => void;
}) {
  const holidayDates = useMemo(
    () => new Set(calendarDays.filter((day) => day.day_type === "holiday").map((day) => day.date)),
    [calendarDays],
  );
  const calendarCells = useMemo(() => buildCalendarCells(selectedMonth), [selectedMonth]);
  const todayKey = getLocalDateKey(new Date());

  return (
    <div className="animate-fade-in">
      <header className="px-1 pt-2">
        <h1 className="text-4xl font-black tracking-normal">カレンダー</h1>
        <p className="mt-1 text-base font-bold text-slate-400 dark:text-slate-500">
          休日とシフト
        </p>
      </header>

      <MonthStepper
        selectedMonth={selectedMonth}
        disabled={loading}
        onMonthChange={onMonthChange}
      />

      {isGroupMode && groupStaff && (
        <CalendarStaffSelector
          staffList={groupStaff}
          staffStatuses={staffStatuses}
          selectedStaffIds={selectedStaffIds}
          loading={loading}
          onSelect={onSelectStaff}
        />
      )}

      {staffReady ? (
        <GlassCard className="mt-5 p-4">
          <div className="grid grid-cols-7 gap-2 text-center">
            {["日", "月", "火", "水", "木", "金", "土"].map((weekday) => (
              <div key={weekday} className="py-2 text-sm font-black text-[#64748B]">
                {weekday}
              </div>
            ))}
            {calendarCells.map((cell) => {
              const isHoliday = holidayDates.has(cell.dateKey);
              const isToday = cell.dateKey === todayKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  disabled={loading || !cell.inMonth}
                  onClick={() => onToggleDay(cell.dateKey)}
                  className={`min-h-16 rounded-2xl border p-1.5 text-center transition active:scale-95 disabled:cursor-default ${
                    isHoliday
                      ? "border-rose-100 bg-rose-50 text-rose-600"
                      : "border-slate-100 bg-white text-[#0F172A]"
                  } ${isToday ? "ring-2 ring-[#6366F1]" : ""} ${
                    cell.inMonth ? "opacity-100" : "opacity-25"
                  }`}
                >
                  <span className="block text-base font-black">{cell.day}</span>
                  <span
                    className={`mt-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-black ${
                      isHoliday ? "bg-rose-100 text-rose-600" : "text-transparent"
                    }`}
                  >
                    {isHoliday ? "休" : "・"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-[#64748B]">
              {selectedStaff ? `${selectedStaff.name} の休日設定` : "休日設定"}
            </p>
            <p className="text-sm font-black text-[#6366F1]">
              休日 {holidayDates.size}日
            </p>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="mt-5 p-6 text-center">
          <p className="text-base font-bold text-slate-400">
            カレンダーを表示するスタッフを選択してください。
          </p>
        </GlassCard>
      )}
    </div>
  );
}

function CalendarStaffSelector({
  staffList,
  staffStatuses,
  selectedStaffIds,
  loading,
  onSelect,
}: {
  staffList: GroupStaffConfig[];
  staffStatuses: GroupStaffStatus[];
  selectedStaffIds: string[];
  loading: boolean;
  onSelect: (staff: GroupStaffConfig) => void;
}) {
  return (
    <GlassCard className="mt-5 p-4">
      <p className="text-sm font-black text-[#64748B]">スタッフ</p>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {staffList.map((staff) => {
          const status = staffStatuses.find((item) => item.id === staff.id);
          const selected = selectedStaffIds[0] === staff.id;
          return (
            <button
              key={staff.id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(staff)}
              className={`min-h-12 shrink-0 rounded-2xl px-4 text-base font-black shadow-sm transition active:scale-95 disabled:opacity-50 ${
                selected
                  ? "bg-[#6366F1] text-white"
                  : "bg-slate-50 text-[#64748B]"
              }`}
            >
              {staff.name}
              {status?.status === "working" && (
                <span className="ml-2 text-xs font-black opacity-80">勤務中</span>
              )}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function MonthlyPanel({
  staffReady,
  selectedMonth,
  summary,
  logs,
  loading,
  onMonthChange,
}: {
  staffReady: boolean;
  selectedMonth: string;
  summary: MonthlySummary | null;
  logs: AttendanceLog[];
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      <header className="px-1 pt-2">
        <h1 className="text-4xl font-black tracking-normal">月次</h1>
        <p className="mt-1 text-base font-bold text-slate-400 dark:text-slate-500">ひと月のまとめ</p>
      </header>
      <MonthStepper
        selectedMonth={selectedMonth}
        disabled={!staffReady}
        onMonthChange={onMonthChange}
      />
      {staffReady ? (
        <>
          <GlassCard className="mt-5 p-6">
            <p className="text-5xl font-black">
              {loading ? "..." : formatDurationLong(summary?.totalWorkMinutes ?? 0)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <SummaryTile label="残業" value={loading ? "..." : formatDurationLong(summary?.overtimeMinutes ?? 0)} />
              <SummaryTile label="出勤日数" value={loading ? "..." : `${summary?.workedDays ?? 0}日`} />
            </div>
          </GlassCard>
          <div className="mt-5 flex flex-col gap-3">
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
    </div>
  );
}

function PdfPanel({
  staffReady,
  selectedMonth,
  monthOptions,
  pdfUrl,
  groupStaff,
  staffStatuses,
  selectedStaffIds,
  isGroupMode,
  recipients,
  email,
  loading,
  message,
  onMonthChange,
  onSelectStaff,
  onEmailChange,
  onAddRecipient,
  onDeleteRecipient,
  onSendEmail,
}: {
  staffReady: boolean;
  selectedMonth: string;
  monthOptions: string[];
  pdfUrl: string;
  groupStaff: GroupStaffConfig[] | null;
  staffStatuses: GroupStaffStatus[];
  selectedStaffIds: string[];
  isGroupMode: boolean;
  recipients: PdfEmailRecipient[];
  email: string;
  loading: boolean;
  message: string;
  onMonthChange: (month: string) => void;
  onSelectStaff: (staff: GroupStaffConfig) => void;
  onEmailChange: (email: string) => void;
  onAddRecipient: () => void;
  onDeleteRecipient: (id: string) => void;
  onSendEmail: () => void;
}) {
  const canSendEmail = staffReady && recipients.length > 0 && !loading;

  return (
    <div className="animate-fade-in">
      <ScreenTitle icon="file" title="PDF" subtitle="月別勤怠を出力" />
      {isGroupMode && groupStaff && (
        <CalendarStaffSelector
          staffList={groupStaff}
          staffStatuses={staffStatuses}
          selectedStaffIds={selectedStaffIds}
          loading={loading}
          onSelect={onSelectStaff}
        />
      )}
      <GlassCard className="mt-5 p-6">
        <MonthSelect
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          disabled={!staffReady}
          onMonthChange={onMonthChange}
        />
        <a
          href={pdfUrl || undefined}
          aria-disabled={!pdfUrl}
          className={`mt-6 flex h-20 w-full items-center justify-center gap-3 rounded-[32px] text-2xl font-black shadow-md transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
            pdfUrl
              ? "bg-gradient-to-br from-slate-900 to-indigo-900 text-white dark:from-indigo-500 dark:to-sky-500"
              : "pointer-events-none bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
          }`}
        >
          <Icon name="download" className="h-7 w-7" />
          PDFを出力
        </a>
        <button
          type="button"
          disabled={!canSendEmail}
          onClick={onSendEmail}
          className="mt-4 flex h-16 w-full items-center justify-center gap-3 rounded-[28px] bg-[#6366F1] text-xl font-black text-white shadow-sm transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Icon name="mail" className="h-6 w-6" />
          PDFをメール送信
        </button>
        {recipients.length === 0 && (
          <p className="mt-3 text-center text-sm font-bold text-slate-400">
            送信先メールアドレスを登録してください
          </p>
        )}
      </GlassCard>

      <GlassCard className="mt-5 p-5">
        <p className="text-base font-black text-[#0F172A]">PDF送信先メールアドレス設定</p>
        <div className="mt-4 flex gap-3">
          <input
            type="email"
            value={email}
            disabled={!staffReady || loading}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="mail@example.com"
            className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition focus:ring-2 focus:ring-[#6366F1]/30 disabled:text-slate-400"
          />
          <button
            type="button"
            disabled={!staffReady || !email.trim() || loading}
            onClick={onAddRecipient}
            className="h-12 rounded-2xl bg-[#6366F1] px-5 text-base font-black text-white shadow-sm transition active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
          >
            追加
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {recipients.length ? (
            recipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="min-w-0 truncate text-base font-bold text-[#0F172A]">
                  {recipient.email}
                </span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onDeleteRecipient(recipient.id)}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-black text-rose-500 shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  削除
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-400">
              登録済みメールアドレスはありません
            </p>
          )}
        </div>
        {message.trim() && <MessageCard message={message} />}
      </GlassCard>
    </div>
  );
}

function BottomNav({
  activePanel,
  onChange,
}: {
  activePanel: ActivePanel;
  onChange: (panel: ActivePanel) => void;
}) {
  const tabs: { id: ActivePanel; label: string; icon: IconName }[] = [
    { id: "home", label: "ホーム", icon: "home" },
    { id: "calendar", label: "カレンダー", icon: "calendar" },
    { id: "monthly", label: "月次", icon: "calendar" },
    { id: "pdf", label: "PDF", icon: "file" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-slate-100 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-sm backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex h-16 flex-col items-center justify-center rounded-2xl text-sm font-bold transition duration-200 active:scale-95 ${
                active
                  ? "bg-white text-[#6366F1] shadow-sm"
                  : "text-[#6B7280] hover:bg-slate-50"
              }`}
            >
              <Icon name={tab.icon} className="h-6 w-6" />
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
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/35 px-4 py-5 backdrop-blur-md sm:items-center">
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-md animate-slide-up rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
      >
        <h2 className="text-2xl font-black">退勤前の確認</h2>
        <p className="mt-2 text-base leading-7 text-slate-500 dark:text-slate-400">
          必要な場合は時刻と休憩設定を調整してください。
        </p>
        <div className="mt-6 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-black text-slate-500 dark:text-slate-400">
            出勤時刻
            <input
              type="datetime-local"
              value={clockInEdit}
              onChange={(event) => onClockInEditChange(event.target.value)}
              className="h-14 rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-black text-slate-500 dark:text-slate-400">
            退勤時刻
            <input
              type="datetime-local"
              value={clockOutEdit}
              onChange={(event) => onClockOutEditChange(event.target.value)}
              className="h-14 rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
              required
            />
          </label>
          <BreakToggle label="休憩設定" value={breakFlag} onChange={onBreakFlagChange} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-3xl bg-slate-100 text-base font-black text-slate-700 transition active:scale-95 dark:bg-white/10 dark:text-slate-200"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-14 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:bg-none disabled:bg-slate-300"
          >
            退勤する
          </button>
        </div>
      </form>
    </div>
  );
}

function MonthlyLogCard({ log }: { log: AttendanceLog }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-black">{formatShortDate(log.date)}</p>
          <p className="mt-2 text-base font-bold text-slate-500 dark:text-slate-400">{formatTimeRange(log)}</p>
          <p className="mt-2 text-sm font-black text-slate-400 dark:text-slate-500">
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
    <label className="flex flex-col gap-2 text-sm font-black text-slate-500 dark:text-slate-400">
      月選択
      <select
        value={selectedMonth}
        disabled={disabled}
        onChange={(event) => onMonthChange(event.target.value)}
        className="h-14 rounded-3xl border border-white/70 bg-white/80 px-4 text-lg font-black text-slate-950 shadow-sm outline-none transition focus:ring-2 focus:ring-blue-300 disabled:text-slate-400 dark:border-white/10 dark:bg-white/10 dark:text-white"
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

function MonthStepper({
  selectedMonth,
  disabled,
  onMonthChange,
}: {
  selectedMonth: string;
  disabled: boolean;
  onMonthChange: (month: string) => void;
}) {
  const previousMonth = shiftMonth(selectedMonth, -1);
  const nextMonth = shiftMonth(selectedMonth, 1);

  return (
    <div className="mt-5 grid grid-cols-[48px_1fr_48px] items-center rounded-2xl bg-white px-2 py-2 shadow-sm">
      <button
        type="button"
        disabled={disabled || !previousMonth}
        onClick={() => previousMonth && onMonthChange(previousMonth)}
        className="grid h-12 w-12 place-items-center rounded-2xl text-[#6366F1] transition hover:bg-slate-50 active:scale-95 disabled:text-slate-300"
        aria-label="前の月"
      >
        <Icon name="chevronLeft" className="h-6 w-6" />
      </button>
      <p className="text-center text-xl font-black text-[#0F172A]">
        {formatMonthLabel(selectedMonth)}
      </p>
      <button
        type="button"
        disabled={disabled || !nextMonth}
        onClick={() => nextMonth && onMonthChange(nextMonth)}
        className="grid h-12 w-12 place-items-center rounded-2xl text-[#6366F1] transition hover:bg-slate-50 active:scale-95 disabled:text-slate-300"
        aria-label="次の月"
      >
        <Icon name="chevronRight" className="h-6 w-6" />
      </button>
    </div>
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
    <label className="flex flex-col gap-3 text-sm font-black text-[#6B7280]">
      <span className="flex items-center gap-2">
        <Icon name="coffee" className="h-5 w-5 text-[#6366F1]" />
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`h-12 rounded-xl px-4 text-base font-bold shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 ${
          value
            ? "bg-[#FF7A1A] text-white shadow-orange-200/80"
            : "bg-slate-100 text-slate-500 shadow-slate-200/80"
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
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 ${className}`}
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
  icon: IconName;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="px-1 pt-2">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl dark:bg-white/10 dark:text-slate-200">
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-4xl font-black tracking-normal">{title}</h1>
          <p className="mt-1 text-base font-bold text-slate-400 dark:text-slate-500">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/70 p-4 shadow-sm dark:bg-white/10">
      <p className="text-sm font-black text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function EmptyStaffNotice() {
  return <EmptyState message="スタッフを選択すると表示されます。" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <GlassCard className="p-6 text-center">
      <p className="text-base font-bold text-slate-400 dark:text-slate-500">{message}</p>
    </GlassCard>
  );
}

function MessageCard({ message }: { message: string }) {
  const visibleMessage = message.trim();
  if (!visibleMessage) return null;

  return (
    <p className="rounded-3xl border border-blue-100 bg-blue-50/90 px-5 py-4 text-base font-bold leading-7 text-blue-800 shadow-sm backdrop-blur-xl dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100">
      {visibleMessage}
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

function ProgressRing({
  progress,
  label,
  status,
}: {
  progress: number;
  label: string;
  status: AttendanceStatus;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const stroke =
    status === "not_clocked_in" ? "stroke-slate-300" : "stroke-[#6366F1]";

  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center">
      <svg className="-rotate-90 h-20 w-20" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${stroke} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-sm font-bold text-[#64748B]">8h</p>
        <p className="mt-1 max-w-16 text-sm font-bold leading-tight text-[#0F172A]">{label}</p>
      </div>
    </div>
  );
}

type IconName =
  | "bag"
  | "calendar"
  | "check"
  | "chevronLeft"
  | "chevronRight"
  | "clock"
  | "coffee"
  | "download"
  | "file"
  | "home"
  | "mail"
  | "play"
  | "refresh"
  | "stop"
  | "users";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (name) {
    case "bag":
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 11H7L6 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <path d="M7 3v4M17 3v4M4 9h16" />
          <path d="M5 5h14a1 1 0 0 1 1 1v15H4V6a1 1 0 0 1 1-1Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "chevronLeft":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "chevronRight":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common}>
          <path d="M5 8h11v5a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4V8Z" />
          <path d="M16 9h2a2 2 0 0 1 0 4h-2M7 3v2M11 3v2M15 3v2" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M7 3h8l4 4v17H7V3Z" />
          <path d="M15 3v5h5M10 13h6M10 17h6" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M6 10v10h12V10" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 5v14l11-7-11-7Z" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6 9a7 7 0 0 1 11-2l3 3" />
          <path d="M18 15a7 7 0 0 1-11 2l-3-3" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="3" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21a6 6 0 0 1 12 0" />
          <path d="M16 11a3 3 0 1 0-1-5" />
          <path d="M17 21a5 5 0 0 0-3-4.5" />
        </svg>
      );
  }
}

type StatusView = ReturnType<typeof getStatusView>;

function getStatusView(status: AttendanceStatus) {
  const views = {
    not_clocked_in: {
      label: "未出勤",
      shortLabel: "待機",
      badge: "bg-slate-100 text-slate-600",
      text: "text-[#111827]",
      dot: "bg-slate-300 dark:bg-slate-500",
      iconBg: "bg-[#EEF2FF] text-[#6366F1]",
      statusCard: "",
      action: "bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]",
    },
    working: {
      label: "勤務中",
      shortLabel: "勤務中",
      badge: "bg-indigo-100 text-indigo-700",
      text: "text-[#111827]",
      dot: "bg-[#6366F1]",
      iconBg: "bg-[#EEF2FF] text-[#6366F1]",
      statusCard: "",
      action: "bg-gradient-to-r from-[#FF7A1A] to-[#F97316]",
    },
    clocked_out: {
      label: "退勤済み",
      shortLabel: "完了",
      badge: "bg-indigo-100 text-indigo-700",
      text: "text-[#111827]",
      dot: "bg-[#6366F1]",
      iconBg: "bg-[#EEF2FF] text-[#6366F1]",
      statusCard: "",
      action: "bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]",
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

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return "";

  const date = new Date(year, monthNumber - 1 + amount, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function buildCalendarCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [];

  const firstDate = new Date(year, monthNumber - 1, 1);
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - firstDate.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      dateKey: getLocalDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthNumber - 1,
    };
  });
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
