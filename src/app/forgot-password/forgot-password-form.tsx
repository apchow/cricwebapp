"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-2xl font-black tracking-tight mb-3">Check your inbox</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          If an account exists for <span className="text-slate-200">{email}</span>,
          a reset link is on its way. It expires in one hour and can only be used
          once. Do not see it? Check your spam folder.
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-xl py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
        >
          Back to sign in
        </Link>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
          className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-8">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80 mb-2">
        Pundit Arena account
      </div>
      <h1 className="text-3xl font-black tracking-tight mb-2">Forgot your password?</h1>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Enter the email you signed up with and we will send you a link to choose a
        new password.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-xs text-slate-500 mt-5">
        Remembered it?{" "}
        <Link href="/login" className="text-slate-400 hover:text-white underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}