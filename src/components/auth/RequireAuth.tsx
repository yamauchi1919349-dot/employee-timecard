"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { TenantRole } from "@/lib/types";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, profileError } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, session]);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoadingScreen />;
  if (profileError) {
    return (
      <AuthShell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">プロフィールが見つかりません</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {profileError}
          </p>
        </div>
      </AuthShell>
    );
  }

  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: TenantRole[];
  children: ReactNode;
}) {
  const { profile } = useAuth();

  if (!profile || !roles.includes(profile.role)) {
    return (
      <AuthShell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">権限がありません</h1>
          <p className="mt-3 text-sm text-slate-600">この操作は許可された権限のユーザーのみ利用できます。</p>
        </div>
      </AuthShell>
    );
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <AuthShell>
      <div className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm">
        読み込み中...
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </main>
  );
}
