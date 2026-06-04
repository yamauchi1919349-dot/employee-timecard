"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, RequireRole } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { CompanySettings, RoundingMethod, WorkRoundingMinutes } from "@/lib/types";

type SettingsPayload = {
  settings?: CompanySettings;
  message?: string;
};

type FormState = {
  work_rounding_minutes: WorkRoundingMinutes;
  rounding_method: RoundingMethod;
  overtimePreset: "480" | "450" | "custom";
  overtimeCustomMinutes: string;
  include_payroll: boolean;
};

const ROUNDING_RULE_OPTIONS: Array<{ value: WorkRoundingMinutes; label: string; note: string }> = [
  { value: 0, label: "打刻通り", note: "出勤・退勤時刻を丸めずに集計します。" },
  { value: 5, label: "5分丸め", note: "5分単位で丸めます。" },
  { value: 10, label: "10分丸め", note: "10分単位で丸めます。" },
  { value: 15, label: "15分丸め", note: "推奨初期値です。" },
  { value: 30, label: "30分丸め", note: "30分単位で丸めます。" },
];

const ROUNDING_METHOD_OPTIONS: Array<{ value: RoundingMethod; label: string }> = [
  { value: "floor", label: "切り捨て" },
  { value: "ceil", label: "切り上げ" },
  { value: "nearest", label: "四捨五入" },
];

export default function AdminSettingsPage() {
  return (
    <RequireAuth>
      <RequireRole roles={["owner", "manager", "admin"]}>
        <AdminSettingsContent />
      </RequireRole>
    </RequireAuth>
  );
}

function AdminSettingsContent() {
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(() => toFormState());
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const overtimeMinutes = useMemo(() => {
    if (form.overtimePreset !== "custom") return Number(form.overtimePreset);
    return Number(form.overtimeCustomMinutes);
  }, [form.overtimeCustomMinutes, form.overtimePreset]);

  useEffect(() => {
    if (!session) return;

    async function loadSettings() {
      setLoading(true);
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const payload = (await response.json()) as SettingsPayload;
      setLoading(false);

      if (!response.ok || !payload.settings) {
        showMessage(payload.message ?? "管理設定の取得に失敗しました。", "error");
        return;
      }

      setForm(toFormState(payload.settings));
    }

    void loadSettings();
  }, [session, showMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    if (!Number.isInteger(overtimeMinutes) || overtimeMinutes < 60 || overtimeMinutes > 1440) {
      showMessage("残業開始時間は1時間以上24時間以内で入力してください。", "error");
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        work_rounding_minutes: form.work_rounding_minutes,
        rounding_method: form.rounding_method,
        overtime_threshold_minutes: overtimeMinutes,
        include_payroll: form.include_payroll,
      }),
    });
    const payload = (await response.json()) as SettingsPayload;
    setSaving(false);

    if (!response.ok || !payload.settings) {
      showMessage(payload.message ?? "管理設定の保存に失敗しました。", "error");
      return;
    }

    setForm(toFormState(payload.settings));
    showMessage("管理設定を保存しました。");
  }

  return (
    <main data-route="sales-admin-settings" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">管理者</p>
            <h1 className="mt-1 text-3xl font-bold">管理設定</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              会社単位の勤怠ルールと給与計算表示を設定します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/monthly"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"
            >
              月次集計
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm"
            >
              ダッシュボードへ戻る
            </Link>
          </div>
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

        <form onSubmit={handleSubmit} className="grid gap-5">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">勤怠ルール設定</h2>
              <p className="text-sm text-slate-500">
                実打刻時刻は保持したまま、管理者月次集計の労働時間・残業時間に反映します。
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                労働時間計算ルール
                <select
                  value={form.work_rounding_minutes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      work_rounding_minutes: Number(event.target.value) as WorkRoundingMinutes,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none focus:border-indigo-500"
                >
                  {ROUNDING_RULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                丸め方式
                <select
                  value={form.rounding_method}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, rounding_method: event.target.value as RoundingMethod }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none focus:border-indigo-500"
                  disabled={form.work_rounding_minutes === 0}
                >
                  {ROUNDING_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                残業開始時間
                <select
                  value={form.overtimePreset}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      overtimePreset: event.target.value as FormState["overtimePreset"],
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none focus:border-indigo-500"
                >
                  <option value="480">8時間超</option>
                  <option value="450">7.5時間超</option>
                  <option value="custom">任意入力</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                任意入力（分）
                <input
                  type="number"
                  min="60"
                  max="1440"
                  step="1"
                  value={form.overtimeCustomMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, overtimeCustomMinutes: event.target.value }))
                  }
                  disabled={form.overtimePreset !== "custom"}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base font-bold outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">給与計算設定</h2>
              <p className="text-sm text-slate-500">
                月次集計に給与目安を表示するかを切り替えます。初期値は「含めない」です。
              </p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              月次集計の給与計算
              <select
                value={form.include_payroll ? "include" : "exclude"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, include_payroll: event.target.value === "include" }))
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-bold outline-none focus:border-indigo-500"
              >
                <option value="exclude">月次集計に給与計算を含めない</option>
                <option value="include">月次集計に給与計算を含める</option>
              </select>
            </label>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">現在の設定</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SettingPreview label="計算ルール" value={getRoundingRuleLabel(form.work_rounding_minutes)} />
              <SettingPreview label="丸め方式" value={getRoundingMethodLabel(form.rounding_method)} />
              <SettingPreview label="残業開始" value={`${formatHours(overtimeMinutes)}超`} />
              <SettingPreview label="給与計算" value={form.include_payroll ? "含める" : "含めない"} />
            </div>
          </section>

          <button
            type="submit"
            disabled={loading || saving}
            className="h-12 rounded-xl bg-indigo-600 px-6 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </form>
      </div>
    </main>
  );
}

function toFormState(settings?: CompanySettings): FormState {
  const overtime = settings?.overtime_threshold_minutes ?? 480;
  const preset = overtime === 480 ? "480" : overtime === 450 ? "450" : "custom";

  return {
    work_rounding_minutes: settings?.work_rounding_minutes ?? 15,
    rounding_method: settings?.rounding_method ?? "nearest",
    overtimePreset: preset,
    overtimeCustomMinutes: String(overtime),
    include_payroll: settings?.include_payroll ?? false,
  };
}

function SettingPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function getRoundingRuleLabel(value: WorkRoundingMinutes) {
  return ROUNDING_RULE_OPTIONS.find((option) => option.value === value)?.label ?? `${value}分丸め`;
}

function getRoundingMethodLabel(value: RoundingMethod) {
  return ROUNDING_METHOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatHours(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "-";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}時間` : `${hours.toFixed(1)}時間`;
}
