"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("パスワードを設定しました。ログイン画面へ移動します。");
    setTimeout(() => router.replace("/login"), 1000);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-bold">新しいパスワード</h1>
        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              minLength={8}
              required
            />
          </label>
          {message ? <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white disabled:opacity-60"
          >
            {submitting ? "設定中..." : "パスワードを設定"}
          </button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-indigo-600">
          ログインへ戻る
        </Link>
      </div>
    </main>
  );
}
