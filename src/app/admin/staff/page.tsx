"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RequireAuth, RequireRole } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { Profile, TenantRole } from "@/lib/types";

export default function StaffAdminPage() {
  return (
    <RequireAuth>
      <RequireRole roles={["owner", "manager"]}>
        <StaffAdminContent />
      </RequireRole>
    </RequireAuth>
  );
}

function StaffAdminContent() {
  const { session, profile } = useAuth();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("staff");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadStaff() {
    if (!session) return;
    setLoading(true);
    const response = await fetch("/api/admin/staff", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.message ?? "スタッフ一覧の取得に失敗しました。");
      return;
    }
    setStaff(payload.staff ?? []);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, role }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setMessage(payload.message ?? "招待に失敗しました。");
      return;
    }

    setName("");
    setEmail("");
    setRole("staff");
    setMessage("招待メールを送信しました。");
    await loadStaff();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <main data-route="sales-admin-staff" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">管理</p>
            <h1 className="mt-1 text-3xl font-bold">スタッフ管理</h1>
          </div>
          <Link
            href="/dashboard"
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 pt-3 text-sm font-bold text-slate-600 shadow-sm"
          >
            戻る
          </Link>
        </header>

        {message ? (
          <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-800 shadow-sm">
            {message}
          </div>
        ) : null}

        <form onSubmit={handleInvite} className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">招待メール送信</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              氏名
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              権限
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as TenantRole)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-indigo-500"
              >
                {profile?.role === "owner" ? <option value="owner">owner</option> : null}
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 h-12 rounded-xl bg-indigo-600 px-6 text-base font-bold text-white disabled:opacity-60"
          >
            {submitting ? "送信中..." : "招待する"}
          </button>
        </form>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">スタッフ一覧</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">読み込み中...</p> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">氏名</th>
                  <th className="py-2 pr-4">メール</th>
                  <th className="py-2 pr-4">権限</th>
                  <th className="py-2 pr-4">作成日</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold">{row.name}</td>
                    <td className="py-3 pr-4">{row.email ?? "-"}</td>
                    <td className="py-3 pr-4">{row.role}</td>
                    <td className="py-3 pr-4">{formatDate(row.created_at)}</td>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
