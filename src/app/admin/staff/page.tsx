"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, RequireRole } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmploymentType, Profile, TenantRole } from "@/lib/types";

type StaffFormState = {
  name: string;
  employee_number: string;
  employment_type: EmploymentType | "";
  hourly_wage: string;
  fixed_salary: string;
  active: boolean;
};

const EMPLOYMENT_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: "full_time", label: "正社員" },
  { value: "part_time", label: "パート・アルバイト" },
  { value: "contract", label: "契約社員" },
  { value: "other", label: "その他" },
];

export default function StaffAdminPage() {
  return (
    <RequireAuth>
      <RequireRole roles={["owner", "manager", "admin"]}>
        <StaffAdminContent />
      </RequireRole>
    </RequireAuth>
  );
}

function StaffAdminContent() {
  const { session, profile } = useAuth();
  const normalizedRole = profile?.role?.trim().toLowerCase() ?? "";
  const [staff, setStaff] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [role, setRole] = useState<TenantRole>("staff");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);

  const activeCount = useMemo(() => staff.filter((row) => row.active).length, [staff]);
  const inactiveCount = staff.length - activeCount;

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadStaff = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    const params = new URLSearchParams();
    if (showInactive) params.set("includeInactive", "true");

    const response = await fetch(`/api/admin/staff?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = (await response.json()) as { staff?: Profile[]; message?: string };
    setLoading(false);

    if (!response.ok) {
      showMessage(payload.message ?? "スタッフ一覧の取得に失敗しました。", "error");
      return;
    }

    setStaff(payload.staff ?? []);
  }, [session, showInactive, showMessage]);

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
      body: JSON.stringify({ name, email, employee_number: employeeNumber, role }),
    });
    const payload = (await response.json()) as { message?: string };
    setSubmitting(false);

    if (!response.ok) {
      showMessage(payload.message ?? "招待に失敗しました。", "error");
      return;
    }

    setName("");
    setEmail("");
    setEmployeeNumber("");
    setRole("staff");
    showMessage("招待メールを送信しました。");
    await loadStaff();
  }

  async function handleDelete(row: Profile) {
    if (!session) return;
    const confirmed = window.confirm(`${row.name} さんを削除しますか？\n過去の勤怠履歴は残り、スタッフは無効化されます。`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/staff?id=${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      showMessage(payload.message ?? "スタッフの削除に失敗しました。", "error");
      return;
    }

    showMessage("スタッフを削除しました。");
    await loadStaff();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStaff();
  }, [loadStaff]);

  return (
    <main data-route="sales-admin-staff" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-bold text-blue-700">管理者</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">スタッフ管理</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              スタッフの基本情報、雇用区分、給与項目、有効状態を管理します。
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            ダッシュボードへ戻る
          </Link>
        </header>

        {message ? (
          <div
            className={`rounded-2xl p-4 text-sm font-semibold shadow-sm ${
              messageType === "success" ? "bg-indigo-50 text-indigo-800" : "bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <form onSubmit={handleInvite} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black">招待メール送信</h2>
            <p className="text-sm text-slate-500">メールアドレスは認証に使うため、招待後はこの画面では編集できません。</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">
              氏名
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              社員番号
              <input
                value={employeeNumber}
                onChange={(event) => setEmployeeNumber(event.target.value)}
                maxLength={64}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
                placeholder="例: 1001"
              />
              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                給与ソフト連携用。未設定でも利用できます。
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as TenantRole)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              >
                {normalizedRole === "owner" ? <option value="owner">owner</option> : null}
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-6 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "送信中..." : "招待する"}
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">スタッフ一覧</h2>
              <p className="mt-1 text-sm text-slate-500">
                有効 {activeCount}名 / 無効 {inactiveCount}名
              </p>
            </div>
            <label className="inline-flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-blue-700"
              />
              無効スタッフを表示
            </label>
          </div>

          {loading ? <p className="mt-4 text-sm text-slate-500">読み込み中...</p> : null}

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-100 lg:block">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">氏名</th>
                  <th className="px-4 py-3">社員番号</th>
                  <th className="px-4 py-3">メール</th>
                  <th className="px-4 py-3">role</th>
                  <th className="px-4 py-3">雇用区分</th>
                  <th className="px-4 py-3">時給</th>
                  <th className="px-4 py-3">固定給</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">作成日/招待日</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.employee_number ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.email ?? "-"}</td>
                    <td className="px-4 py-3">{row.role}</td>
                    <td className="px-4 py-3">{getEmploymentLabel(row.employment_type)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.hourly_wage)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.fixed_salary)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={row.active} />
                    </td>
                    <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <StaffActions row={row} onEdit={setEditingStaff} onDelete={handleDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 lg:hidden">
            {staff.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{row.name}</h3>
                    <p className="mt-1 break-all text-sm text-slate-500">{row.email ?? "-"}</p>
                  </div>
                  <StatusBadge active={row.active} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <StaffMetric label="role" value={row.role} />
                  <StaffMetric label="社員番号" value={row.employee_number ?? "-"} />
                  <StaffMetric label="雇用区分" value={getEmploymentLabel(row.employment_type)} />
                  <StaffMetric label="時給" value={formatCurrency(row.hourly_wage)} />
                  <StaffMetric label="固定給" value={formatCurrency(row.fixed_salary)} />
                  <StaffMetric label="作成日/招待日" value={formatDate(row.created_at)} />
                </div>
                <div className="mt-4">
                  <StaffActions row={row} onEdit={setEditingStaff} onDelete={handleDelete} />
                </div>
              </article>
            ))}
          </div>

          {!loading && staff.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              表示できるスタッフがいません。
            </div>
          ) : null}
        </section>
      </div>

      {editingStaff ? (
        <EditStaffModal
          staff={editingStaff}
          sessionToken={session?.access_token ?? ""}
          onClose={() => setEditingStaff(null)}
          onSaved={async () => {
            setEditingStaff(null);
            showMessage("スタッフ情報を保存しました。");
            await loadStaff();
          }}
          onError={(text) => showMessage(text, "error")}
        />
      ) : null}
    </main>
  );
}

function StaffActions({
  row,
  onEdit,
  onDelete,
}: {
  row: Profile;
  onEdit: (row: Profile) => void;
  onDelete: (row: Profile) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
      >
        編集
      </button>
      {row.active ? (
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
        >
          削除
        </button>
      ) : null}
    </div>
  );
}

function EditStaffModal({
  staff,
  sessionToken,
  onClose,
  onSaved,
  onError,
}: {
  staff: Profile;
  sessionToken: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<StaffFormState>(() => ({
    name: staff.name,
    employee_number: staff.employee_number ?? "",
    employment_type: staff.employment_type ?? "",
    hourly_wage: staff.hourly_wage === null ? "" : String(staff.hourly_wage),
    fixed_salary: staff.fixed_salary === null ? "" : String(staff.fixed_salary),
    active: staff.active,
  }));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) return;

    setSaving(true);
    const response = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: staff.id,
        name: form.name,
        employee_number: form.employee_number,
        employment_type: form.employment_type || null,
        hourly_wage: form.hourly_wage === "" ? null : Number(form.hourly_wage),
        fixed_salary: form.fixed_salary === "" ? null : Number(form.fixed_salary),
        active: form.active,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setSaving(false);

    if (!response.ok) {
      onError(payload.message ?? "スタッフ情報の保存に失敗しました。");
      return;
    }

    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-slate-950/45 px-4 py-5 backdrop-blur-sm sm:items-center">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">スタッフ編集</h2>
            <p className="mt-1 text-sm text-slate-500">メールアドレスは表示のみです。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-bold text-slate-500 transition hover:bg-slate-200"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            氏名
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            メールアドレス
            <input
              value={staff.email ?? ""}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-500"
              readOnly
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            社員番号
            <input
              value={form.employee_number}
              onChange={(event) => setForm((current) => ({ ...current, employee_number: event.target.value }))}
              maxLength={64}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              placeholder="例: 1001"
            />
            <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
              給与ソフト連携用。未設定でも利用できます。
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            雇用区分
            <select
              value={form.employment_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, employment_type: event.target.value as EmploymentType | "" }))
              }
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
            >
              <option value="">未設定</option>
              {EMPLOYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            有効/無効
            <select
              value={form.active ? "active" : "inactive"}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.value === "active" }))
              }
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
            >
              <option value="active">有効</option>
              <option value="inactive">無効</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            時給
            <input
              type="number"
              min="0"
              step="1"
              value={form.hourly_wage}
              onChange={(event) => setForm((current) => ({ ...current, hourly_wage: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              placeholder="未設定"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            固定給
            <input
              type="number"
              min="0"
              step="1"
              value={form.fixed_salary}
              onChange={(event) => setForm((current) => ({ ...current, fixed_salary: event.target.value }))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-50"
              placeholder="未設定"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl bg-slate-100 px-5 text-base font-bold text-slate-700 transition hover:bg-slate-200"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 rounded-xl bg-slate-950 px-6 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "有効" : "無効"}
    </span>
  );
}

function getEmploymentLabel(value: EmploymentType | null) {
  return EMPLOYMENT_OPTIONS.find((option) => option.value === value)?.label ?? "未設定";
}

function formatCurrency(value: number | null) {
  if (value === null) return "未設定";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
