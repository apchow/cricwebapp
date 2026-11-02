export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm uppercase tracking-widest font-bold">
          Loading…
        </span>
      </div>
    </div>
  );
}
