"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginForm({
  next,
  initialMode = "login",
}: {
  next: string;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      if (!response.ok) {
        setError("Could not start the demo session");
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
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
      <h1 className="text-3xl font-black tracking-tight mb-2">
        {mode === "login" ? "Sign in" : "Create your account"}
      </h1>
      <p className="text-sm text-slate-400 mb-6">
        {mode === "login"
          ? "Your saved XIs and match history live on your account."
          : "One email and password. Your XIs, matches and takes are stored on our servers, so they follow you between devices."}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setError(null);
            }}
            className={`rounded-lg py-2 text-sm font-bold transition-all ${
              mode === item
                ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-200"
                : "bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {item === "login" ? "Sign in" : "Register"}
          </button>
        ))}
      </div>

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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div>
          <label
            className="text-xs text-slate-500 mb-1.5 block"
            htmlFor="password"
          >
            Password {mode === "register" && "(min 8 characters)"}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
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
          {busy
            ? "Working…"
            : mode === "login"
            ? "Sign in"
            : "Create account and continue"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-slate-800" />
        <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
          or
        </span>
        <span className="flex-1 h-px bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={demo}
        disabled={busy}
        className="w-full rounded-xl py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ⚡ Look around the demo account
      </button>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        The demo is one read-only account shared by every visitor — you can look
        around, but nothing you do there is saved. Create a free account to keep
        your own XIs, matches and takes.
      </p>

      <p className="text-xs text-slate-500 mt-5">
        Scoring and the wall need an account.{" "}
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
