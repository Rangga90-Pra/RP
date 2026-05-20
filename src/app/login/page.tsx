"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { configured, session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (configured && session) router.replace("/dashboard");
  }, [configured, session, router]);

  if (!configured) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-slate-900">Login</h1>
        <p className="text-sm text-slate-600">
          Supabase belum dikonfigurasi. Tambahkan <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di file{" "}
          <code className="rounded bg-slate-100 px-1">.env.local</code>, lalu jalankan ulang dev server. Tanpa itu, gunakan{" "}
          <Link className="text-teal-700 underline" href="/dashboard">
            mode lokal
          </Link>
          .
        </p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Premi &amp; Solar Sopir Ritase</h1>
        <p className="mt-1 text-sm text-slate-600">Masuk dengan akun Supabase (email &amp; password).</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              className="input mt-1 h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              className="input mt-1 h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {err ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="btn-primary h-11 w-full px-4">
            {busy ? "Memproses…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
