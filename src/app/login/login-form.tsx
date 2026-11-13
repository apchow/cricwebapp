"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginForm({
  next,
  googleEnabled = false,
  notice = null,
}: {
  next: string;
  googleEnabled?: boolean;
  notice?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guest() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      if (!response.ok) {
        setError("Could not start the guest session");
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-8">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80 mb-2">
        Pundit Arena account
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-2">Sign in</h1>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Sign in with Google and your saved XIs, scored matches and banter follow
        you to any device — no password to remember, nothing to reset.
      </p>

      {notice && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4">
          {notice}
        </p>
      )}

      {googleEnabled ? (
        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 font-bold bg-white text-slate-800 hover:bg-slate-100 active:scale-[0.99] transition-all"
        >
          <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.24 17.76 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.46-4.81 7.14l7.43 5.78C43.39 37.44 46.98 31.36 46.98 24.55z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.35-.76-2.77-.76-4.28s.28-2.93.76-4.28l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.43-5.78c-2.18 1.45-5.02 2.31-8.47 2.31-6.24 0-11.57-3.74-13.47-8.84l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </a>
      ) : (
        <p className="text-sm text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
          Google sign-in isn&apos;t configured on this deployment yet.
        </p>
      )}

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-slate-800" />
        <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
          or
        </span>
        <span className="flex-1 h-px bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={guest}
        disabled={busy}
        className="w-full rounded-xl py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        👀 Just looking — continue as Guest
      </button>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        Guest is one read-only view shared by every visitor — you can look around,
        but nothing you do is saved. Sign in with Google to keep your own XIs,
        matches and takes.
      </p>

      <p className="text-xs text-slate-500 mt-5">
        <Link href="/" className="text-slate-400 hover:text-white underline">
          Back to hub
        </Link>
      </p>
      <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-slate-500 hover:text-slate-300 underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-slate-500 hover:text-slate-300 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}