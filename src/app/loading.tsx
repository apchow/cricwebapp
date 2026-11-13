export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div
        className="w-full max-w-md glass rounded-2xl p-6 space-y-5"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-slate-400">
            Loading
          </span>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-2/3 rounded bg-slate-800 animate-pulse" />
          <div className="h-3 w-full rounded bg-slate-800/70 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-slate-800/70 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-slate-800/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}