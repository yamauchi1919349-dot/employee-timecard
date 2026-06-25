"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { TenantRole } from "@/lib/types";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { developerMode, session, loading, profileError, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, session]);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoadingScreen />;
  if (profileError) {
    async function handleSignOut() {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    }

    return (
      <AuthShell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">プロフィールが見つかりません</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{profileError}</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {signingOut ? "ログアウト中..." : "ログアウトして再ログイン"}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      {children}
      {developerMode ? <DeveloperModeBadge /> : null}
    </>
  );
}

export function RequireRole({
  roles,
  children,
}: {
  roles: TenantRole[];
  children: ReactNode;
}) {
  const { developerMode, profile } = useAuth();
  const role = (developerMode ? "owner" : profile?.role?.trim().toLowerCase()) as TenantRole | undefined;

  if (!role || !roles.includes(role)) {
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

function DeveloperModeBadge() {
  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-white shadow-sm">
      Developer Mode
    </div>
  );
}
