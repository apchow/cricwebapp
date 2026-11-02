import Link from "next/link";

/**
 * Shared page header for the tool screens: eyebrow, gradient title, blurb and
 * the way back to the hub. The XI builder keeps its centred hero instead.
 */
export default function ToolHeader({
  eyebrow,
  title,
  blurb,
  gradient,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  gradient: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-2">
          {eyebrow}
        </div>
        <h1
          className={`text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
        >
          {title}
        </h1>
        <p className="text-slate-400 mt-2 max-w-lg">{blurb}</p>
      </div>
      <Link
        href="/"
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        ← Back to hub
      </Link>
    </header>
  );
}
