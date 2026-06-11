"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowser } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const { session, loading } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!acceptedTerms) {
      setMessage("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/signup-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        adminName,
        email,
        password,
        acceptedTerms,
      }),
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setSubmitting(false);
      setMessage(payload.message ?? "新規登録に失敗しました。入力内容をご確認ください。");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      setMessage("登録は完了しました。ログイン画面から登録したメールアドレスでログインしてください。");
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main data-route="sales-signup" className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <header className="text-center">
          <p className="text-sm font-semibold text-indigo-600">ArcNest Timecard</p>
          <h1 className="mt-2 text-3xl font-bold">新規企業登録</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            会社用の管理者アカウントを作成します。最初のユーザーはownerとして登録されます。
            7日間無料トライアル終了後、登録した支払い方法で自動課金されます。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
            会社名
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              autoComplete="organization"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            管理者名
            <input
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              autoComplete="name"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              autoComplete="email"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600"
            />
            <span>
              <Link href="/terms" target="_blank" className="font-black text-blue-700 underline-offset-4 hover:underline">
                利用規約
              </Link>
              と
              <Link href="/privacy" target="_blank" className="font-black text-blue-700 underline-offset-4 hover:underline">
                プライバシーポリシー
              </Link>
              に同意します。
            </span>
          </label>

          {message ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? "登録中..." : "登録して開始する"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
            支払い手続きでは、7日間無料トライアル終了後の自動課金についてStripe上でも確認できます。
          </p>
        </form>

        <Link href="/login" className="text-center text-sm font-semibold text-indigo-600">
          すでにアカウントをお持ちの方はログイン
        </Link>
      </div>
    </main>
  );
}
