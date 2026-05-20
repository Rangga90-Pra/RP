"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchProfile } from "@/lib/supabase/api";
import type { UserProfile } from "@/lib/types";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!configured) return;
    const client = getSupabaseBrowserClient();
    const { data } = await client.auth.getUser();
    const uid = data.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(client, uid);
    setProfile(p);
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      setSession(null);
      setProfile(null);
      return;
    }
    const client = getSupabaseBrowserClient();
    let cancelled = false;

    void client.auth.getSession().then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setError(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!configured || !session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        const p = await fetchProfile(client, session.user.id);
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat profil");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, session?.user]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!configured) return { error: "Supabase tidak dikonfigurasi." };
      const client = getSupabaseBrowserClient();
      const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (e) return { error: e.message };
      await refreshProfile();
      return { error: null };
    },
    [configured, refreshProfile],
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    const client = getSupabaseBrowserClient();
    await client.auth.signOut();
    setProfile(null);
    setSession(null);
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      error,
      session,
      user: session?.user ?? null,
      profile,
      signIn,
      signOut,
      refreshProfile,
    }),
    [configured, loading, error, session, profile, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      configured: false,
      loading: false,
      error: null,
      session: null,
      user: null,
      profile: null,
      signIn: async () => ({ error: null }),
      signOut: async () => {},
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
