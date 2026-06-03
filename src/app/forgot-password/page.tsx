"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const siteUrl = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/reset-password`,
    });
    setSubmitting(false);
    setMessage(
      error
        ? error.message
        : "パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。",
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-bold">パスワード再設定</h1>
        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500"
              required
            />
          </label>
          {message ? <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white disabled:opacity-60"
          >
            {submitting ? "送信中..." : "再設定メールを送信"}
          </button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-indigo-600">
          ログインへ戻る
        </Link>
      </div>
    </main>
  );
}
