"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function LegalBackButton() {
  const { loading, session } = useAuth();
  const href = session ? "/dashboard" : "/login";

  return (
    <Link
      href={href}
      aria-disabled={loading}
      className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 aria-disabled:pointer-events-none aria-disabled:opacity-60"
    >
      ← ダッシュボードへ戻る
    </Link>
  );
}
