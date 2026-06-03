"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { SalesTimecardApp } from "@/components/SalesTimecardApp";

type DashboardPayload = {
  company: { id: string; name: string; plan?: string } | null;
  workDate: string;
  attendance: AuthAttendance[];
};

type AuthAttendance = {
  id: string;
  user_id: string;
  clock_in: string | null;
  clock_out: string | null;
  work_date: string;
  profiles?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardRouter />
    </RequireAuth>
  );
}

function DashboardRouter() {
  const { loading, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  if (loading || !profile || !role) {
    return <DashboardLoading />;
  }

  if (role === "staff") {
    return <SalesTimecardApp />;
  }

  return <DashboardContent role={role} />;
}

function DashboardContent({ role }: { role: string }) {
  const { session, profile, signOut } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    if (!session) return;
    setLoading(true);
    const response = await fetch("/api/auth/dashboard", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.message ?? "ダッシュボードの取得に失敗しました。");
      return;
    }
    setData(payload);
    setMessage(null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (role === "staff") {
    return <DashboardLoading />;
  }

  return (
    <main data-route="sales-dashboard" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">{data?.company?.name ?? "Timecard"}</p>
            <h1 className="mt-1 text-3xl font-bold">ダッシュボード</h1>
            <p className="mt-2 text-sm text-slate-500">
              {profile?.name} / {role}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"
          >
            ログアウト
          </button>
        </header>

        {message ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">本日</p>
          <h2 className="mt-2 text-2xl font-bold">{data?.workDate ?? "-"}</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">読み込み中...</p> : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">氏名</th>
                  <th className="py-2 pr-4">出勤</th>
                  <th className="py-2 pr-4">退勤</th>
                  <th className="py-2 pr-4">状態</th>
                </tr>
              </thead>
              <tbody>
                {(data?.attendance ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{row.profiles?.name ?? row.user_id}</td>
                    <td className="py-3 pr-4">{formatTime(row.clock_in)}</td>
                    <td className="py-3 pr-4">{formatTime(row.clock_out)}</td>
                    <td className="py-3 pr-4">{row.clock_out ? "退勤済み" : "出勤中"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <nav className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm">
            legacy ホーム
          </Link>
          <Link href="/admin/staff" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm">
            スタッフ管理
          </Link>
          {role === "owner" || role === "admin" ? (
            <Link href="/admin/staff" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm">
              管理メニュー
            </Link>
          ) : null}
        </nav>
      </div>
    </main>
  );
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
        読み込み中...
      </div>
    </main>
  );
}

function normalizeRole(role?: string | null) {
  return role?.trim().toLowerCase() ?? "";
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
