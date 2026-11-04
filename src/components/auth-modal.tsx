"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, ShieldCheck, Sparkles, X } from "lucide-react";

import { useArena } from "@/store/arena";

export default function AuthModal() {
  const open = useArena((state) => state.modalOpen);
  const closeAuth = useArena((state) => state.closeAuth);
  const syncFromServer = useArena((state) => state.syncFromServer);
  const pathname = usePathname();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoFailed, setDemoFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAuth, open]);

  useEffect(() => {
    if (!open) {
      setDemoBusy(false);
      setDemoFailed(false);
    }
  }, [open]);

  /** Real accounts live on the server, so the form is a page, not a modal. */
  function goToLogin() {
    const next = encodeURIComponent(pathname || "/");
    window.location.assign(`/login?next=${next}`);
  }

  async function useDemo() {
    setDemoBusy(true);
    setDemoFailed(false);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      await syncFromServer();
      closeAuth();
    } catch {
      setDemoFailed(true);
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close sign in"
            onClick={closeAuth}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to Pundit Arena"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-sm rounded-3xl glass p-7 shadow-2xl shadow-black/60"
          >
            <button
              type="button"
              onClick={closeAuth}
              aria-label="Close"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center mb-4 shadow-lg shadow-fuchsia-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>

            <h2 className="text-2xl font-black tracking-tight mb-1.5">
              Join the arena
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              An account keeps your saved XIs, scored matches and takes on the
              wall — they belong to you, not to this browser.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 font-semibold bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <LogIn className="w-5 h-5" />
                Sign in or create an account
              </button>

              <button
                type="button"
                onClick={useDemo}
                disabled={demoBusy}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:bg-slate-800 disabled:opacity-60 transition-all"
              >
                {demoBusy ? "Opening the demo…" : "Just looking — demo account"}
              </button>
            </div>

            {demoFailed && (
              <p className="mt-3 text-xs text-red-300">
                The demo could not be opened right now. Sign in instead, or try
                again in a minute.
              </p>
            )}

            <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-emerald-500/70" />
              <span>
                The demo is <strong className="text-slate-400">one account shared
                by every visitor</strong> — anything saved there is visible to the
                next person who taps it. Create an account to keep your own.
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
