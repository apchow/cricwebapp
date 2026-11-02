import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 text-white">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-3">🧭</div>
        <h1 className="text-2xl font-black mb-2">Out of bounds</h1>
        <p className="text-sm text-slate-400 mb-6">
          We could not find that page. It may have been moved, or never existed.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.01] transition-all"
        >
          Back to the hub
        </Link>
      </div>
    </div>
  );
}
