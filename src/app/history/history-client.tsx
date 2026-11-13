"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
  Search,
  Share2,
  Trash2,
  Trophy,
} from "lucide-react";

import Toast from "@/components/toast";
import ToolHeader from "@/components/tool-header";
import { MatchScorecard } from "@/components/scorecard";
import { BattingTable, BowlingTable } from "@/components/stat-tables";
import { useToast } from "@/lib/client";
import { matchDate } from "@/lib/dates";
import type { PublicMatch } from "@/lib/dto";
import { battingStats, bowlingStats } from "@/lib/stats";
import { useArena, useArenaHydration } from "@/store/arena";

type AnalyticsTab = "batting" | "bowling";

function Stat({
  label,
  value,
  hint,
  accent = "text-slate-100",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
        {label}
      </div>
      <div className={`text-2xl font-black font-mono truncate ${accent}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-1 truncate">{hint}</div>}
    </div>
  );
}

export default function HistoryClient() {
  useArenaHydration();
  const user = useArena((state) => state.user);
  const checked = useArena((state) => state.checked);
  const readOnly = user?.demo ?? false;

  const [matches, setMatches] = useState<PublicMatch[] | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("ALL");
  const [venue, setVenue] = useState("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<AnalyticsTab>("batting");
  const [showAll, setShowAll] = useState(false);
  const { message: toast, notify } = useToast();

  useEffect(() => {
    if (!checked) return;
    if (!user) {
      setNeedsAccount(true);
      setMatches([]);
      return;
    }
    let cancelled = false;
    fetch("/api/matches")
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setNeedsAccount(true);
          setMatches([]);
          return;
        }
        const data = (await response.json()) as { matches?: PublicMatch[] };
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [checked, user]);

  async function remove(id: string) {
    if (readOnly) {
      notify("The demo account is read-only. Create a free account to keep your own matches.");
      return;
    }
    setMatches((prev) => (prev ? prev.filter((match) => match.id !== id) : prev));
    const response = await fetch(`/api/matches/${id}`, { method: "DELETE" }).catch(
      () => null
    );
    notify(response && response.ok ? "Match deleted" : "Could not delete that match");
  }

  async function share(match: PublicMatch) {
    if (readOnly) {
      notify("The demo account is read-only. Create a free account to share your own matches.");
      return;
    }
    const response = await fetch(`/api/matches/${match.id}/share`, {
      method: "POST",
    }).catch(() => null);
    if (!response || !response.ok) {
      notify("Could not create a share link");
      return;
    }
    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      notify("Could not create a share link");
      return;
    }
    const url = `${window.location.origin}/share/${data.token}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify("Share link copied");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: match.scoreline, text: match.result, url });
        return;
      }
      notify("Could not copy the share link");
    } catch {
      notify("Could not copy the share link");
    }
  }

  const formats = useMemo(
    () => Array.from(new Set((matches ?? []).map((match) => match.format))).sort(),
    [matches]
  );
  const venues = useMemo(
    () => Array.from(new Set((matches ?? []).map((match) => match.venue))).sort(),
    [matches]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (matches ?? []).filter((match) => {
      if (format !== "ALL" && match.format !== format) return false;
      if (venue !== "ALL" && match.venue !== venue) return false;
      if (
        needle &&
        !match.scoreline.toLowerCase().includes(needle) &&
        !match.result.toLowerCase().includes(needle) &&
        !match.venue.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [matches, query, format, venue]);

  const batting = useMemo(() => battingStats(matches ?? []), [matches]);
  const bowling = useMemo(() => bowlingStats(matches ?? []), [matches]);

  const totals = useMemo(() => {
    let runs = 0;
    let wickets = 0;
    let sixes = 0;
    let balls = 0;
    let highest: { runs: number; wickets: number; team: string } | null = null;
    for (const match of matches ?? []) {
      for (const innings of match.innings) {
        runs += innings.runs;
        wickets += innings.wickets;
        balls += innings.legalBalls;
        for (const batter of innings.batters) sixes += batter.sixes;
        if (!highest || innings.runs > highest.runs) {
          highest = {
            runs: innings.runs,
            wickets: innings.wickets,
            team: innings.battingTeam,
          };
        }
      }
    }
    return { runs, wickets, sixes, balls, highest };
  }, [matches]);

  const innsCount = (matches ?? []).reduce(
    (total, match) => total + match.innings.length,
    0
  );

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <Toast message={toast} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Match Centre"
          title="History & Analytics"
          blurb="Every match you have scored, with the full scorecard, the run worm and your career leaderboards."
          gradient="from-amber-200 via-white to-emerald-200"
        />

        {matches === null && (
          <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            Loading your match history…
          </div>
        )}

        {matches !== null && needsAccount && (
          <div className="glass rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">📒</div>
            <h2 className="text-2xl font-black mb-2">Your scorebook is private</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Sign in and every match you score is saved here with the full
              scorecard, worm chart and career figures.
            </p>
            <Link
              href="/login?next=/history"
              className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-amber-500 to-emerald-500 hover:scale-[1.02] transition-all"
            >
              Sign in
            </Link>
          </div>
        )}

        {matches !== null && !needsAccount && matches.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">🏏</div>
            <h2 className="text-2xl font-black mb-2">No matches yet</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Score your first match and it lands here with the scorecard, the
              run worm and career leaderboards.
            </p>
            <Link
              href="/scorer"
              className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
            >
              Start scoring
            </Link>
          </div>
        )}

        {matches !== null && !needsAccount && matches.length > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Stat
                label="Matches"
                value={matches.length}
                hint={`${innsCount} innings`}
                accent="text-emerald-300"
              />
              <Stat
                label="Runs scored"
                value={totals.runs}
                hint={totals.balls ? `${totals.balls} balls` : undefined}
                accent="text-sky-300"
              />
              <Stat
                label="Wickets taken"
                value={totals.wickets}
                hint={`${totals.sixes} sixes hit`}
                accent="text-rose-300"
              />
              <Stat
                label="Highest total"
                value={totals.highest ? totals.highest.runs : "—"}
                hint={
                  totals.highest
                    ? `${totals.highest.team} · ${totals.highest.wickets} down`
                    : undefined
                }
                accent="text-amber-300"
              />
            </div>

            <section className="mb-10">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Career leaderboards
                </h2>
                <div className="flex items-center gap-2">
                  {(
                    [
                      ["batting", "Batting"],
                      ["bowling", "Bowling"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        tab === id
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                          : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAll((value) => !value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white transition-all"
                  >
                    {showAll ? "Top 10" : "Show all"}
                  </button>
                </div>
              </div>

              {tab === "batting" ? (
                batting.length ? (
                  <BattingTable rows={batting} limit={showAll ? undefined : 10} />
                ) : (
                  <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">
                    No batting figures yet.
                  </div>
                )
              ) : bowling.length ? (
                <BowlingTable rows={bowling} limit={showAll ? undefined : 10} />
              ) : (
                <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">
                  No bowling figures yet.
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Match history
                </h2>
                <span className="text-xs text-slate-500">
                  {visible.length} of {matches.length}
                </span>
              </div>

              <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a scoreline, result or venue…"
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All formats</option>
                  {formats.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={venue}
                  onChange={(event) => setVenue(event.target.value)}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All venues</option>
                  {venues.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {visible.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">
                  No matches match those filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((match) => {
                    const open = openId === match.id;
                    return (
                      <div
                        key={match.id}
                        className="glass rounded-2xl overflow-hidden"
                      >
                        <div className="flex items-center gap-3 p-4">
                          <button
                            onClick={() => setOpenId(open ? null : match.id)}
                            aria-expanded={open}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                              {match.format} · {match.venue} · {matchDate(match.createdAt)}
                            </div>
                            <div className="text-sm font-mono text-slate-200 truncate">
                              {match.scoreline}
                            </div>
                            <div className="text-xs text-emerald-300/90 mt-0.5 truncate">
                              {match.result}
                            </div>
                          </button>
                          <ChevronDown
                            className={`w-5 h-5 shrink-0 text-slate-500 transition-transform ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                          <button
                            onClick={() => share(match)}
                            aria-label={`Copy a share link for ${match.scoreline}`}
                            title="Copy a public share link"
                            className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(match.id)}
                            aria-label={`Delete match ${match.scoreline}`}
                            className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                <MatchScorecard innings={match.innings} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
