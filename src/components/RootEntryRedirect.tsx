"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TimecardApp } from "@/components/TimecardApp";
import { createSupabaseBrowser } from "@/lib/supabase";
import { isReservedMemberKey } from "@/lib/reserved-routes";

export function RootEntryRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const requestedKey = searchParams.get("k")?.trim() || null;
  const employeeKey =
    requestedKey && !isReservedMemberKey(requestedKey) ? requestedKey : null;

  useEffect(() => {
    if (employeeKey) return;

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      router.replace(data.session ? "/dashboard" : "/login");
    });

    return () => {
      mounted = false;
    };
  }, [employeeKey, router, supabase]);

  if (employeeKey) {
    return <TimecardApp employeeKey={employeeKey} initialData={null} />;
  }

  return <RootEntryLoading />;
}

export function RootEntryLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-5 text-center text-sm font-semibold text-slate-600 shadow-sm">
          ログイン状態を確認しています...
        </div>
      </div>
    </main>
  );
}
