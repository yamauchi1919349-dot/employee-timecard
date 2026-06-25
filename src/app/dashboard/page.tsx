"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardLegalLinks } from "@/components/DashboardLegalLinks";
import { SalesTimecardApp } from "@/components/SalesTimecardApp";
import { isBillingGracePeriodActive, isCompanySubscriptionActive } from "@/lib/billing-status";

type DashboardPayload = {
  company: {
    id: string;
    name: string;
    plan?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    current_period_end?: string | null;
    billing_grace_period_started_at?: string | null;
    billing_grace_period_ends_at?: string | null;
    billing_email?: string | null;
  } | null;
  workDate: string;
  attendance: AuthAttendance[];
  pendingTimeEditRequestCount?: number;
  developerMode?: boolean;
  developerCompanyMode?: boolean;
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
  const { developerMode, loading, profile } = useAuth();
  const role = developerMode ? "owner" : normalizeRole(profile?.role);

  if (loading || !profile || !role) {
    return <DashboardLoading />;
  }

  if (role === "staff") {
    return <SalesTimecardApp />;
  }

  return <DashboardContent role={role} />;
}

function DashboardContent({ role }: { role: string }) {
  const { developerMode, session, profile, refreshProfile, signOut } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [checkoutMessage] = useState<string | null>(() => getCheckoutMessage());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState<"checkout" | "portal" | null>(null);
  const displayedMessage = message ?? checkoutMessage;
  const isDeveloperMode = developerMode || data?.developerMode === true;
  const developerBillingBypass = isDeveloperMode || data?.developerCompanyMode === true;
  const billingAllowed = developerBillingBypass || isCompanySubscriptionActive(data?.company);
  const ownerBillingRestricted = role === "owner" && !billingAllowed;
  const nonOwnerBillingRestricted = role !== "owner" && !billingAllowed;

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

  async function openBillingSession(type: "checkout" | "portal") {
    if (!session) return;
    setBillingLoading(type);
    setMessage(null);
    try {
      const response = await fetch(
        type === "checkout" ? "/api/billing/create-checkout-session" : "/api/billing/create-portal-session",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const payload = (await response.json()) as {
        url?: string;
        message?: string;
      };
      if (!response.ok || !payload.url) throw new Error(payload.message ?? "Stripeの画面を開けませんでした。");
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Stripeの画面を開けませんでした。");
      setBillingLoading(null);
    }
  }

  if (role === "staff") {
    return <DashboardLoading />;
  }

  if (!isDeveloperMode && role === "owner" && !profile?.terms_accepted_at) {
    return <TermsAcceptanceScreen sessionToken={session?.access_token ?? ""} onAccepted={refreshProfile} onSignOut={signOut} />;
  }

  if (loading && !data) {
    return <DashboardLoading />;
  }

  return (
    <main data-route="sales-dashboard" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">{data?.company?.name ?? "Timecard"}</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">管理者ダッシュボード</h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {profile?.name ?? "管理者"} / {role}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <button
                type="button"
                onClick={signOut}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                ログアウト
              </button>
            </div>
          </div>
        </header>

        {displayedMessage ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm">
            {displayedMessage}
          </div>
        ) : null}

        {billingAllowed ? (
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
                badgeCount={data?.pendingTimeEditRequestCount ?? 0}
                label="打刻修正依頼"
                description="修正依頼の承認・却下と、ownerによる直接修正を行います。"
              />
            ) : null}
          </nav>
        ) : null}

        {role === "owner" && !isDeveloperMode ? (
          <BillingCard
            company={data?.company ?? null}
            restricted={ownerBillingRestricted}
            loading={billingLoading}
            onCheckout={() => openBillingSession("checkout")}
            onPortal={() => openBillingSession("portal")}
          />
        ) : null}

        {nonOwnerBillingRestricted ? <AdminBillingRestrictedNotice /> : null}

        {billingAllowed ? (
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
        ) : null}

        <DashboardLegalLinks />
      </div>
    </main>
  );
}

function TermsAcceptanceScreen({
  sessionToken,
  onAccepted,
  onSignOut,
}: {
  sessionToken: string;
  onAccepted: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function acceptTerms() {
    if (!sessionToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/terms", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "利用規約への同意に失敗しました。");
      await onAccepted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用規約への同意に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold text-blue-700">ArcNest</p>
          <h1 className="mt-3 text-3xl font-black tracking-normal">利用規約への同意</h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
            ownerとして管理画面を利用するには、初回のみ利用規約への同意が必要です。
            内容をご確認のうえ「同意する」を押してください。
          </p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-600">
            <Link className="font-black text-blue-700 underline-offset-4 hover:underline" href="/terms" target="_blank">
              利用規約を確認する
            </Link>
            <p className="mt-2">同意後、管理者ダッシュボードへ進めます。staffにはこの確認は表示されません。</p>
          </div>
          {message ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{message}</p> : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={acceptTerms}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {saving ? "保存中..." : "同意する"}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              ログアウト
            </button>
          </div>
        </section>

        <DashboardLegalLinks />
      </div>
    </main>
  );
}

function AdminMenuCard({
  href,
  label,
  description,
  badgeCount = 0,
}: {
  href: string;
  label: string;
  description: string;
  badgeCount?: number;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950">{label}</p>
        {badgeCount > 0 ? (
          <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-black text-white shadow-sm">
            {badgeCount}
          </span>
        ) : null}
      </div>
      <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{description}</p>
      <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition group-hover:bg-blue-700">
        開く
      </span>
    </Link>
  );
}

function AdminBillingRestrictedNotice() {
  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm sm:p-8">
      <p className="text-sm font-black text-amber-700">利用開始手続きが必要です</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">管理者による支払い登録をお待ちください</h2>
      <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
        ArcNest Timecardを利用するには、会社のownerが7日間無料トライアルを開始する必要があります。
      </p>
    </section>
  );
}

function BillingCard({
  company,
  restricted,
  loading,
  onCheckout,
  onPortal,
}: {
  company: DashboardPayload["company"];
  restricted?: boolean;
  loading: "checkout" | "portal" | null;
  onCheckout: () => void;
  onPortal: () => void;
}) {
  const status = company?.subscription_status ?? "未契約";
  const canOpenPortal = Boolean(company?.stripe_customer_id);
  const canUsePortalFirst = canOpenPortal && company?.subscription_status !== null && company?.subscription_status !== undefined;
  const graceActive = isBillingGracePeriodActive(company);
  const graceExpired = status === "past_due" && !graceActive;
  const suspended = restricted || graceExpired;
  const needsInitialCheckout = !company?.stripe_customer_id;

  return (
    <section className={`rounded-2xl border border-blue-100 bg-white shadow-sm ${restricted ? "p-6 sm:p-8" : "p-5 sm:p-6"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">支払い管理</p>
          <h2 className={`${restricted ? "mt-3 text-3xl" : "mt-2 text-xl"} font-black text-slate-950`}>
            {suspended
              ? needsInitialCheckout
                ? "7日間無料トライアルを開始してください"
                : "お支払い確認が取れないため利用を一時停止しています"
              : "ArcNest Timecard 月額利用料"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            7日間無料トライアル終了後、特別価格 月額3,980円（税込）の固定サブスクリプションとして自動課金されます。
            通常価格は月額6,480円（税込）です。スタッフ人数による追加料金はありません。
            カード情報はStripeで安全に管理されます。
          </p>
          {graceActive && company?.billing_grace_period_ends_at ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
              お支払いを確認できません。猶予期間中です。{formatDate(company.billing_grace_period_ends_at)}
              までにお支払い方法をご確認ください。
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              契約状態: {getSubscriptionStatusLabel(status)}
            </span>
            {company?.current_period_end ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                次回更新目安: {formatDate(company.current_period_end)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          {canUsePortalFirst ? (
            <button
              type="button"
              onClick={onPortal}
              disabled={loading !== null}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading === "portal" ? "Stripeを開いています..." : "支払い方法・契約を管理"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCheckout}
              disabled={loading !== null}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-300"
            >
              {loading === "checkout" ? "Stripeを開いています..." : "7日間無料トライアルを開始"}
            </button>
          )}
          <p className="max-w-xs text-xs font-semibold leading-5 text-slate-500">
            想定利用人数は1社あたり50名程度までです。大規模利用は個別にご相談ください。
          </p>
        </div>
      </div>
    </section>
  );
}

function getSubscriptionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "契約中",
    trialing: "無料トライアル中",
    past_due: "支払い確認が必要",
    unpaid: "未払い",
    canceled: "解約済み",
    incomplete: "手続き未完了",
    incomplete_expired: "手続き期限切れ",
    paused: "停止中",
    "未契約": "未契約",
  };
  return labels[status] ?? status;
}

function getCheckoutMessage() {
  if (typeof window === "undefined") return null;
  const checkout = new URLSearchParams(window.location.search).get("checkout");
  if (checkout === "success") {
    return "お支払い手続きが完了しました。契約状態はStripeからの通知後に反映されます。";
  }
  if (checkout === "cancel") {
    return "決済手続きがキャンセルされました。必要な場合は再度お試しください。";
  }
  return null;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
