"use client";

import Link from "next/link";
import { useState } from "react";

export default function AccountMenu({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);

  if (!email) {
    return (
      <Link
        href="/login"
        className="ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/25 transition-all"
      >
        Sign in
      </Link>
    );
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/");
  }

  return (
    <div className="ml-1 flex items-center gap-2">
      <span className="hidden md:inline text-xs text-slate-500 font-mono max-w-[160px] truncate">
        {email}
      </span>
      <button
        onClick={signOut}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/40 transition-all disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
