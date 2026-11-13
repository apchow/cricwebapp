import Link from "next/link";
import { Suspense } from "react";
import LiveBoard from "@/components/live-board";
import { LiveBoardSkeleton } from "@/components/live-board-skeleton";
import { TOOLS } from "@/data/tools";
import { fetchLiveFeed } from "@/lib/live";

/**
 * The only part of the home page that waits on the network. Kept in its own
 * async component so the hero, tool cards and footer render in the static shell
 * and the scores stream in behind a skeleton instead of blocking the whole page.
 */
async function LiveScores() {
  const live = await fetchLiveFeed();
  return <LiveBoard initial={live} />;
}

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] bg-orange-600/6 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24">
        {/* Hero */}
        <header className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/50 bg-slate-800/30 text-xs font-medium text-slate-400 uppercase tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Pundit Arena — Season 2027
          </div>
          <h1 className="text-6xl sm:text-7xl font-black tracking-tighter mb-6">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
              PUNDIT ARENA
            </span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Your seat in the pundit arena.{" "}
            <br className="hidden sm:block" />
            Retain your six. Build the XI. Score the game. Smash the sixes.
          </p>
        </header>

        <Suspense fallback={<LiveBoardSkeleton />}>
          <LiveScores />
        </Suspense>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group relative rounded-2xl p-px transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Gradient border on hover */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tool.cardGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />

              {/* Card */}
              <div className="relative h-full bg-slate-900/90 rounded-[15px] p-8 border border-slate-800/50 group-hover:border-transparent transition-all">
                {/* Glow */}
                <div
                  className={`absolute -top-20 -right-20 w-40 h-40 ${tool.glow} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}
                />

                <div className="relative">
                  <div className="text-4xl mb-2">{tool.emoji}</div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    {tool.subtitle}
                  </div>
                  <h2 className="text-2xl font-bold mb-3 group-hover:text-white transition-colors">
                    {tool.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {tool.description}
                  </p>

                  {/* Feature pills */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {tool.features.map((f) => (
                      <span
                        key={f}
                        className="px-2.5 py-1 rounded-full bg-slate-800/80 text-xs font-medium text-slate-400"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center text-sm font-bold tracking-wider uppercase text-slate-500 group-hover:text-white transition-colors">
                    Launch
                    <span className="ml-2 group-hover:translate-x-1.5 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-32 text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full border border-slate-800/50 text-slate-600 text-xs font-medium uppercase tracking-widest">
            Pundit Arena
          </div>
          <p className="text-[11px] text-slate-600 max-w-xl mx-auto leading-relaxed">
            A fan-made cricket playground. Not affiliated with, endorsed by, or
            connected to the BCCI, the IPL, or any franchise. Player names and
            team marks belong to their respective owners.
          </p>
          <nav className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              Terms
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
