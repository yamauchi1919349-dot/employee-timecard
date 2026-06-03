"use client";

import { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase";
import { Profile } from "@/lib/types";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function loadProfile(nextSession = session) {
    if (!nextSession?.access_token) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    const response = await fetch("/api/auth/profile", {
      headers: {
        Authorization: `Bearer ${nextSession.access_token}`,
      },
    });
    const payload = (await response.json()) as {
      profile?: Profile;
      message?: string;
    };

    if (!response.ok || !payload.profile) {
      setProfile(null);
      setProfileError(payload.message ?? "管理者に招待設定を確認してください。");
      return;
    }

    if (payload.profile.user_id !== nextSession.user.id) {
      setProfile(null);
      setProfileError("ログイン中ユーザーとプロフィールの user_id が一致しません。");
      return;
    }

    setProfile(payload.profile);
    setProfileError(null);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setProfile(null);
      await loadProfile(data.session);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setProfileError(null);
      setLoading(true);
      loadProfile(nextSession).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      refreshProfile: () => loadProfile(session),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, profile, profileError, session, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
