"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 text-white">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-3">🏏</div>
        <h1 className="text-2xl font-black mb-2">That delivery went wrong</h1>
        <p className="text-sm text-slate-400 mb-6">
          Something broke while loading this screen. Try again — anything you
          saved to your account is safe.
        </p>
        <button
          onClick={reset}
          className="w-full rounded-xl py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
