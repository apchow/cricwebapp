"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Sparkles, X } from "lucide-react";

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

  /** Google is the only account sign-in; the start route hands off to it. */
  function goToGoogle() {
    const next = encodeURIComponent(pathname || "/");
    window.location.assign(`/api/auth/google?next=${next}`);
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
              Sign in with Google to keep your saved XIs, scored matches and
              takes on the wall — they belong to you, not to this browser.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={goToGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 font-semibold bg-white text-slate-800 hover:bg-slate-100 active:scale-[0.98] transition-all"
              >
                <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.24 17.76 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.46-4.81 7.14l7.43 5.78C43.39 37.44 46.98 31.36 46.98 24.55z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.35-.76-2.77-.76-4.28s.28-2.93.76-4.28l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.43-5.78c-2.18 1.45-5.02 2.31-8.47 2.31-6.24 0-11.57-3.74-13.47-8.84l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={useDemo}
                disabled={demoBusy}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:bg-slate-800 disabled:opacity-60 transition-all"
              >
                {demoBusy
                  ? "Starting your guest view…"
                  : "Just looking — continue as Guest"}
              </button>
            </div>

            {demoFailed && (
              <p className="mt-3 text-xs text-red-300">
                The guest view couldn&apos;t be opened right now. Sign in with
                Google, or try again in a minute.
              </p>
            )}

            <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-emerald-500/70" />
              <span>
                Guest is <strong className="text-slate-400">one read-only view
                shared by every visitor</strong> — anything saved there is visible
                to the next person who taps it. Sign in with Google to keep your own.
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
