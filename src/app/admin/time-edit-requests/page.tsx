"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, RequireRole } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getRequestStatusLabel,
  getRequestTypeLabel,
  getWorkTypeLabel,
  SALES_WORK_TYPE_OPTIONS,
} from "@/lib/time-edit";
import { Profile, SalesWorkType } from "@/lib/types";

type EditRequest = {
  id: string;
  profile_id: string;
  target_date: string;
  request_type: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_break_minutes: number | null;
  reason: string;
  status: string;
  owner_comment: string | null;
  created_at: string;
  attendance?: { work_type?: SalesWorkType | null } | null;
  profiles?: { name?: string | null; email?: string | null } | null;
};

type EditHistory = {
  id: string;
  profile_id: string;
  edit_type: string;
  before_clock_in: string | null;
  before_clock_out: string | null;
  before_break_minutes: number | null;
  before_work_type: SalesWorkType | null;
  after_clock_in: string | null;
  after_clock_out: string | null;
  after_break_minutes: number | null;
  after_work_type: SalesWorkType | null;
  reason: string;
  owner_comment: string | null;
  source: string;
  created_at: string;
  profiles?: { name?: string | null } | null;
};

type DirectForm = {
  profileId: string;
  targetDate: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: string;
  workType: SalesWorkType;
  reason: string;
};

export default function AdminTimeEditRequestsPage() {
  return (
    <RequireAuth>
      <RequireRole roles={["owner"]}>
        <AdminTimeEditRequestsContent />
      </RequireRole>
    </RequireAuth>
  );
}

function AdminTimeEditRequestsContent() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [histories, setHistories] = useState<EditHistory[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [directForm, setDirectForm] = useState<DirectForm>(() => ({
    profileId: "",
    targetDate: getDateKey(new Date()),
    clockIn: "",
    clockOut: "",
    breakMinutes: "60",
    workType: "normal",
    reason: "",
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const [requestsResponse, historyResponse, staffResponse] = await Promise.all([
      fetch("/api/admin/time-edit-requests", { headers }),
      fetch("/api/time-edit-history", { headers }),
      fetch("/api/admin/staff", { headers }),
    ]);
    const [requestsPayload, historyPayload, staffPayload] = await Promise.all([
      requestsResponse.json(),
      historyResponse.json(),
      staffResponse.json(),
    ]);
    setLoading(false);

    if (!requestsResponse.ok) return showMessage(requestsPayload.message ?? "修正依頼の取得に失敗しました。", "error");
    if (!historyResponse.ok) return showMessage(historyPayload.message ?? "修正履歴の取得に失敗しました。", "error");
    if (!staffResponse.ok) return showMessage(staffPayload.message ?? "スタッフ一覧の取得に失敗しました。", "error");

    setRequests(requestsPayload.requests ?? []);
    setHistories(historyPayload.histories ?? []);
    setStaff(staffPayload.staff ?? []);
  }, [session, showMessage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function reviewRequest(id: string, action: "approve" | "reject") {
    if (!session) return;
    const confirmed = window.confirm(action === "approve" ? "この依頼を承認して打刻へ反映しますか？" : "この依頼を却下しますか？");
    if (!confirmed) return;

    setSubmitting(true);
    const response = await fetch("/api/admin/time-edit-requests", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, action, ownerComment: comments[id] ?? "" }),
    });
    const payload = await response.json();
    setSubmitting(false);
    if (!response.ok) return showMessage(payload.message ?? "処理に失敗しました。", "error");
    showMessage(action === "approve" ? "修正依頼を承認しました。" : "修正依頼を却下しました。");
    await loadData();
  }

  async function handleDirectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!directForm.reason.trim()) return showMessage("直接修正には理由が必要です。", "error");
    const confirmed = window.confirm("入力内容で打刻を直接修正しますか？");
    if (!confirmed) return;

    setSubmitting(true);
    const response = await fetch("/api/admin/time-edits/direct", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileId: directForm.profileId,
        targetDate: directForm.targetDate,
        clockIn: directForm.clockIn ? directForm.clockIn.slice(11, 16) : null,
        clockOut: directForm.clockOut ? directForm.clockOut.slice(11, 16) : null,
        breakMinutes: Number(directForm.breakMinutes),
        workType: directForm.workType,
        reason: directForm.reason,
      }),
    });
    const payload = await response.json();
    setSubmitting(false);
    if (!response.ok) return showMessage(payload.message ?? "直接修正に失敗しました。", "error");

    setDirectForm((current) => ({ ...current, reason: "" }));
    showMessage("打刻を直接修正しました。");
    await loadData();
  }

  return (
    <main data-route="admin-time-edit-requests" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-bold text-blue-700">owner</p>
            <h1 className="mt-2 text-3xl font-black">打刻修正</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              staffからの修正依頼を承認/却下し、必要に応じて直接修正できます。
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm">
            ダッシュボードへ戻る
          </Link>
        </header>

        {message ? (
          <div className={`rounded-2xl p-4 text-sm font-bold shadow-sm ${messageType === "success" ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-700"}`}>
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">修正依頼一覧</h2>
              <p className="mt-1 text-sm text-slate-500">申請中 {pendingRequests.length}件 / 全 {requests.length}件</p>
            </div>
            {loading ? <p className="text-sm font-bold text-slate-500">読み込み中...</p> : null}
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[1260px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">申請日時</th>
                  <th className="px-4 py-3">staff</th>
                  <th className="px-4 py-3">対象日</th>
                  <th className="px-4 py-3">勤務区分</th>
                  <th className="px-4 py-3">修正種別</th>
                  <th className="px-4 py-3">希望出勤</th>
                  <th className="px-4 py-3">希望退勤</th>
                  <th className="px-4 py-3">希望休憩</th>
                  <th className="px-4 py-3">理由</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">{formatDateTime(request.created_at)}</td>
                    <td className="px-4 py-3 font-bold">{request.profiles?.name ?? "未登録"}</td>
                    <td className="px-4 py-3">{request.target_date}</td>
                    <td className="px-4 py-3">{formatWorkType(request.attendance?.work_type)}</td>
                    <td className="px-4 py-3">{getRequestTypeLabel(request.request_type)}</td>
                    <td className="px-4 py-3">{formatTime(request.requested_clock_in)}</td>
                    <td className="px-4 py-3">{formatTime(request.requested_clock_out)}</td>
                    <td className="px-4 py-3">{request.requested_break_minutes ?? "-"}分</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">{request.reason}</td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3">
                      {request.status === "pending" ? (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <input
                            value={comments[request.id] ?? ""}
                            onChange={(event) => setComments((current) => ({ ...current, [request.id]: event.target.value }))}
                            placeholder="ownerコメント"
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-700"
                          />
                          <div className="flex gap-2">
                            <button disabled={submitting} onClick={() => reviewRequest(request.id, "approve")} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">
                              承認
                            </button>
                            <button disabled={submitting} onClick={() => reviewRequest(request.id, "reject")} className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white">
                              却下
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">{request.owner_comment ?? "-"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">ownerによる直接修正</h2>
          <form onSubmit={handleDirectSubmit} className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              対象staff
              <select value={directForm.profileId} onChange={(event) => setDirectForm((current) => ({ ...current, profileId: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-blue-700" required>
                <option value="">選択してください</option>
                {staff.filter((row) => row.role === "staff").map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              対象日
              <input type="date" value={directForm.targetDate} onChange={(event) => setDirectForm((current) => ({ ...current, targetDate: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-bold outline-none focus:border-blue-700" required />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              勤務区分
              <select value={directForm.workType} onChange={(event) => setDirectForm((current) => ({ ...current, workType: event.target.value as SalesWorkType }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-blue-700">
                {SALES_WORK_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              出勤時刻
              <input type="datetime-local" value={directForm.clockIn} onChange={(event) => setDirectForm((current) => ({ ...current, clockIn: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-bold outline-none focus:border-blue-700" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              退勤時刻
              <input type="datetime-local" value={directForm.clockOut} onChange={(event) => setDirectForm((current) => ({ ...current, clockOut: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-bold outline-none focus:border-blue-700" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              休憩時間（分）
              <input type="number" min="0" max="240" value={directForm.breakMinutes} onChange={(event) => setDirectForm((current) => ({ ...current, breakMinutes: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-bold outline-none focus:border-blue-700" />
            </label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-3">
              理由
              <textarea value={directForm.reason} onChange={(event) => setDirectForm((current) => ({ ...current, reason: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-700" required />
            </label>
            <button disabled={submitting} className="h-12 rounded-xl bg-slate-950 px-6 font-bold text-white lg:col-span-3">
              直接修正を保存
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">修正履歴</h2>
          <div className="mt-5 grid gap-3">
            {histories.map((history) => (
              <article key={history.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black">{history.profiles?.name ?? "未登録スタッフ"} / {history.source === "direct" ? "直接修正" : "依頼経由"}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(history.created_at)}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-600">{getRequestTypeLabel(history.edit_type)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">理由: {history.reason}</p>
                <p className="mt-2 text-sm text-slate-600">
                  出勤 {formatTime(history.before_clock_in)} → {formatTime(history.after_clock_in)} / 退勤 {formatTime(history.before_clock_out)} → {formatTime(history.after_clock_out)} / 休憩 {history.before_break_minutes ?? "-"}分 → {history.after_break_minutes ?? "-"}分
                </p>
                <p className="mt-1 text-sm text-slate-600">勤務区分 {formatWorkType(history.before_work_type)} → {formatWorkType(history.after_work_type)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{getRequestStatusLabel(status)}</span>;
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

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatWorkType(value?: string | null) {
  return value ? getWorkTypeLabel(value) : "-";
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
