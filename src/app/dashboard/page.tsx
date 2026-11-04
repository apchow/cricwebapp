import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/store";
import { playerById } from "@/data/player-db";
import { flagOf } from "@/lib/flags";
import { activityStreak, battingStats, bowlingStats } from "@/lib/stats";

export const metadata = { title: "Dashboard — Pundit Arena" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await currentSession();
  if (!session) redirect("/login?next=/dashboard");

  const { xis, matches } = await query((db) => ({
    xis: db.xis
      .filter((xi) => xi.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    matches: db.matches
      .filter((match) => match.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));

  const streak = activityStreak([
    ...xis.map((xi) => xi.createdAt),
    ...matches.map((match) => match.createdAt),
  ]);

  const batting = battingStats(matches);
  const bowling = bowlingStats(matches);
  const bestBat = batting[0] ?? null;
  const bestBowl =
    [...bowling].sort(
      (a, b) => b.wickets - a.wickets || a.runs - b.runs
    )[0] ?? null;

  const picked = new Map<number, number>();
  for (const xi of xis) {
    for (const id of xi.players) picked.set(id, (picked.get(id) ?? 0) + 1);
  }
  const favouriteId = Array.from(picked.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
  const favourite =
    favouriteId !== undefined ? playerById(favouriteId) ?? null : null;

  const empty = !xis.length && !matches.length;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 right-1/4 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/80 mb-2">
              Your account
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-200 via-white to-emerald-200 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-slate-400 mt-2">
              Signed in as{" "}
              <span className="text-slate-200 font-mono text-sm">
                {session.email}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/scorer"
              className="rounded-xl px-4 py-2.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
            >
              Score a match
            </Link>
            <Link
              href="/xi-builder"
              className="rounded-xl px-4 py-2.5 text-sm font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
            >
              Build an XI
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Tile label="Matches scored" value={matches.length} accent="text-emerald-300" />
          <Tile label="XIs saved" value={xis.length} accent="text-sky-300" />
          <Tile
            label="Day streak"
            value={streak}
            accent="text-amber-300"
            hint={streak > 0 ? "Keep it alive" : "Score or save today"}
          />
          <Tile
            label="Favourite pick"
            value={favourite ? favourite.name.split(" ").slice(-1)[0] : "—"}
            accent="text-violet-300"
            hint={favourite ? `${flagOf(favourite.country)} ${favourite.country}` : "Build an XI"}
          />
        </div>

        {empty ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">🏏</div>
            <h2 className="text-2xl font-black mb-2">Your season starts here</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Score your first match or save an XI and this page fills up with
              your streaks, personal bests and history.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/scorer"
                className="rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
              >
                Start scoring
              </Link>
              <Link
                href="/xi-builder"
                className="rounded-xl px-6 py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
              >
                Build your XI
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <section className="glass rounded-2xl p-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Personal bests
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Best innings
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {bestBat ? `${bestBat.highScore}` : "—"}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {bestBat ? bestBat.name : "No innings yet"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Best bowling
                    </div>
                    <div className="text-2xl font-black font-mono">
                      {bestBowl ? `${bestBowl.bestWickets}/${bestBowl.bestRuns}` : "—"}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {bestBowl ? bestBowl.name : "No spells yet"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                    Saved XIs
                  </h2>
                  <Link
                    href="/xi-builder"
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Manage →
                  </Link>
                </div>
                {xis.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No saved XIs yet. Build one to pin your best eleven here.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {xis.slice(0, 10).map((xi) => {
                      const names = xi.players
                        .map((id) => playerById(id)?.name)
                        .filter((name): name is string => Boolean(name));
                      return (
                        <div
                          key={xi.id}
                          className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm truncate">
                              {xi.name}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {xi.players.length} players
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {names.length
                              ? names.join(" · ")
                              : "Players no longer in the database"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Recent matches
                </h2>
                <Link
                  href="/history"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Full history →
                </Link>
              </div>
              {matches.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No matches saved yet. Score one to build your history.
                </p>
              ) : (
                <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1 custom-scrollbar">
                  {matches.slice(0, 10).map((match) => (
                    <div
                      key={match.id}
                      className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2.5"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        {match.format} · {match.venue} ·{" "}
                        {new Date(match.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                      <div className="text-xs font-mono text-slate-300 leading-relaxed">
                        {match.scoreline}
                      </div>
                      <div className="text-[11px] text-emerald-300/90 mt-1">
                        {match.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
        {label}
      </div>
      <div className={`text-3xl font-black font-mono truncate ${accent}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
