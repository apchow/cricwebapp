"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-2xl font-black tracking-tight mb-3">This link is incomplete</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          The reset link is missing its token. Request a fresh one and open the
          link straight from the email.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block w-full rounded-xl py-3 font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-black tracking-tight mb-3">Password updated</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Your new password is set and you are signed in. Your saved XIs, matches
          and takes are right where you left them.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="w-full rounded-xl py-3 font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          Enter Pundit Arena
        </button>
      </div>
    );
  }

  const expired = error?.includes("invalid or has expired");

  return (
    <div className="glass rounded-2xl p-6 sm:p-8">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80 mb-2">
        Pundit Arena account
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-2">Choose a new password</h1>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Pick something at least 8 characters long. You will be signed in as soon
        as it is saved.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block" htmlFor="password">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1.5 block" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl py-3 font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>

      {expired && (
        <Link
          href="/forgot-password"
          className="mt-4 inline-block w-full text-center rounded-xl py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
        >
          Request a new link
        </Link>
      )}

      <p className="text-xs text-slate-500 mt-5">
        <Link href="/login" className="text-slate-400 hover:text-white underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}