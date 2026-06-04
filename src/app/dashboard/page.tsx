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
    <main data-route="sales-dashboard" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">{data?.company?.name ?? "Timecard"}</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">管理者ダッシュボード</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {profile?.name ?? "管理者"} / {role}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              ログアウト
            </button>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
            {message}
          </div>
        ) : null}

        <nav className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <AdminMenuCard
            href="/admin/monthly"
            label="月次集計"
            description="勤怠実績、丸め後の労働時間、CSV出力を確認します。"
          />
          <AdminMenuCard
            href="/admin/staff"
            label="スタッフ管理"
            description="スタッフ情報、雇用区分、時給、固定給、有効状態を管理します。"
          />
          <AdminMenuCard
            href="/admin/settings"
            label="管理設定"
            description="勤怠ルール、残業開始時間、給与計算表示を設定します。"
          />
          {role === "owner" ? (
            <AdminMenuCard
              href="/admin/time-edit-requests"
              label="打刻修正"
              description="修正依頼の承認・却下と、ownerによる直接修正を行います。"
            />
          ) : null}
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">本日の出勤状況</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{data?.workDate ?? "-"}</h2>
            </div>
            {loading ? <p className="text-sm font-semibold text-slate-500">読み込み中...</p> : null}
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">氏名</th>
                  <th className="px-4 py-3">出勤</th>
                  <th className="px-4 py-3">退勤</th>
                  <th className="px-4 py-3">状態</th>
                </tr>
              </thead>
              <tbody>
                {(data?.attendance ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{row.profiles?.name ?? row.user_id}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(row.clock_in)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(row.clock_out)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.clock_out ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`}>
                        {row.clock_out ? "退勤済み" : "出勤中"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminMenuCard({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <p className="text-lg font-black text-slate-950">{label}</p>
      <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{description}</p>
      <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition group-hover:bg-blue-700">
        開く
      </span>
    </Link>
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
