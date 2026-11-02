export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] glass rounded-xl px-5 py-3 text-sm text-emerald-200 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-slide-up"
    >
      {message}
    </div>
  );
}
