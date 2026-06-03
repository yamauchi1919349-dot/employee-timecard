"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const next = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    if (!loading && session) router.replace(next);
  }, [loading, next, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace(next);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMessage("ログアウトしました。");
  }

  return (
    <main data-route="sales-login" className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="text-center">
          <p className="text-sm font-semibold text-indigo-600">Timecard</p>
          <h1 className="mt-2 text-3xl font-bold">ログイン</h1>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
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
              autoComplete="current-password"
              required
            />
          </label>

          {message ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600"
          >
            ログアウト
          </button>
        </form>

        <Link href="/forgot-password" className="text-center text-sm font-semibold text-indigo-600">
          パスワードを忘れた方
        </Link>
      </div>
    </main>
  );
}
