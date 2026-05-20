"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { configured, loading, session, profile, error } = useAuth();

  useEffect(() => {
    if (!configured) return;
    if (loading) return;
    if (!session && pathname?.startsWith("/dashboard")) {
      router.replace("/login");
    }
  }, [configured, loading, session, pathname, router]);

  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-700">
        Memuat sesi…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-700">
        Mengalihkan ke login…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-rose-50 px-4 text-center text-rose-900">
        <p className="font-semibold">Autentikasi / profil</p>
        <p className="max-w-md text-sm">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-700">
        Memuat profil pengguna…
      </div>
    );
  }

  return <>{children}</>;
}
