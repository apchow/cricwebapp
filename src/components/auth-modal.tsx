"use client";

import { useEffect, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Sparkles, X } from "lucide-react";

import { useArena, type AuthProvider } from "@/store/arena";

/** Brand marks are inlined: lucide dropped its provider logos. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.85 8.87 4.74 12 4.74Z"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="currentColor">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const PROVIDERS: {
  id: AuthProvider;
  label: string;
  mark: () => ReactElement;
  className: string;
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    mark: GoogleMark,
    className:
      "bg-white text-slate-900 hover:bg-slate-100 border border-white/20",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    mark: GithubMark,
    className:
      "bg-slate-800 text-white hover:bg-slate-700 border border-slate-600/70",
  },
];

export default function AuthModal() {
  const open = useArena((state) => state.modalOpen);
  const closeAuth = useArena((state) => state.closeAuth);
  const signIn = useArena((state) => state.signIn);
  const [pending, setPending] = useState<AuthProvider | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAuth, open]);

  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  function choose(provider: AuthProvider) {
    setPending(provider);
    // Deliberately instant: the identity is minted locally so nobody has to
    // wait on a redirect to start using the arena.
    window.setTimeout(() => signIn(provider), 180);
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
              One tap and you are in. No passwords, no verification emails — your
              retentions, XIs and banter follow you around.
            </p>

            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const Mark = provider.mark;
                const busy = pending === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => choose(provider.id)}
                    disabled={pending !== null}
                    className={`w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${provider.className}`}
                  >
                    <Mark />
                    <span>{busy ? "Signing you in…" : provider.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-emerald-500/70" />
              <span>
                Demo sign-in. Your profile lives in this browser and is never
                shared with anyone.
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
