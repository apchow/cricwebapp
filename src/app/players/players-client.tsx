"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/toast";
import ToolHeader from "@/components/tool-header";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  PLAYERS,
  ROLE_COLORS,
  ROLE_LABELS,
  type PlayerRole,
} from "@/data/players";
import type { PublicMatch } from "@/lib/dto";
import {
  battingAverage,
  battingStats,
  bowlingAverage,
  bowlingStats,
  economy,
  strikeRate,
  type BattingStats,
  type BowlingStats,
} from "@/lib/stats";

const FAVOURITES_KEY = "crichub.favourites";
type Tab = "squad" | "batting" | "bowling";
type Sort = "rating" | "name" | "country";

export default function PlayersClient() {
  const [tab, setTab] = useState<Tab>("squad");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("ALL");
  const [role, setRole] = useState<PlayerRole | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("rating");
  const [favourites, setFavourites] = useState<number[]>([]);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [matches, setMatches] = useState<PublicMatch[] | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);

  const { message: toast, notify } = useToast();

  useEffect(() => {
    const stored = readLocal(FAVOURITES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          setFavourites(parsed.filter((id): id is number => typeof id === "number"));
        }
      } catch {
        /* ignore malformed favourites */
      }
    }
  }, []);

  useEffect(() => {
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
  }, []);

  function toggleFavourite(id: number) {
    setFavourites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      writeLocal(FAVOURITES_KEY, JSON.stringify(next));
      return next;
    });
  }

  const squad = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = PLAYERS.filter((player) => {
      if (country !== "ALL" && player.country !== country) return false;
      if (role !== "ALL" && player.role !== role) return false;
      if (onlyFavourites && !favourites.includes(player.id)) return false;
      if (
        needle &&
        !player.name.toLowerCase().includes(needle) &&
        !player.country.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "country") {
        return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
      }
      return b.rating - a.rating || a.name.localeCompare(b.name);
    });
  }, [query, country, role, sort, onlyFavourites, favourites]);

  const batting = useMemo(() => {
    if (!matches) return [];
    const needle = query.trim().toLowerCase();
    return battingStats(matches).filter(
      (row) => !needle || row.name.toLowerCase().includes(needle)
    );
  }, [matches, query]);

  const bowling = useMemo(() => {
    if (!matches) return [];
    const needle = query.trim().toLowerCase();
    return bowlingStats(matches).filter(
      (row) => !needle || row.name.toLowerCase().includes(needle)
    );
  }, [matches, query]);

  const activeFilters = country !== "ALL" || role !== "ALL" || onlyFavourites;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-sky-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <Toast message={toast} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Player Stats"
          title="Player Stats Hub"
          blurb="Every player, every figure — filter the squad database or dig into the numbers from your own scored matches."
          gradient="from-sky-300 via-cyan-200 to-violet-300"
        />

        <div className="glass rounded-2xl p-4 sm:p-5 mb-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              ["squad", "Squad database"],
              ["batting", "My batting"],
              ["bowling", "My bowling"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  tab === id
                    ? "bg-sky-500/20 border-sky-500/40 text-sky-200"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "squad" ? "Search players or country…" : "Search a name…"
            }
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />

          {tab === "squad" && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["ALL", "BAT", "BOWL", "AR", "WK"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      role === item
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {item === "ALL" ? "All roles" : ROLE_LABELS[item]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                <button
                  onClick={() => setCountry("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    country === "ALL"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  All
                </button>
                {COUNTRIES.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCountry(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      country === item
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {COUNTRY_FLAGS[item]} {item}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="rating">Sort: rating</option>
                  <option value="name">Sort: name</option>
                  <option value="country">Sort: country</option>
                </select>
                <button
                  onClick={() => setOnlyFavourites((value) => !value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    onlyFavourites
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ★ Favourites ({favourites.length})
                </button>
                {activeFilters && (
                  <button
                    onClick={() => {
                      setCountry("ALL");
                      setRole("ALL");
                      setOnlyFavourites(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {tab === "squad" && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {squad.length} of {PLAYERS.length} players
            </p>
            {squad.length === 0 ? (
              <EmptyCard text="No players match those filters." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {squad.map((player) => (
                  <article
                    key={player.id}
                    className="rounded-2xl p-px transition-transform duration-200 hover:scale-[1.02]"
                  >
                    <div className="h-full bg-slate-900/90 rounded-[15px] p-4 border border-slate-800/60">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{player.flag}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {player.country}
                            </span>
                          </div>
                          <h3 className="font-bold truncate mt-0.5">
                            {player.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => toggleFavourite(player.id)}
                          aria-label={
                            favourites.includes(player.id)
                              ? `Remove ${player.name} from favourites`
                              : `Add ${player.name} to favourites`
                          }
                          className={`w-7 h-7 shrink-0 rounded-lg text-sm transition-all ${
                            favourites.includes(player.id)
                              ? "text-amber-300 bg-amber-500/15"
                              : "text-slate-600 hover:text-amber-300 hover:bg-amber-500/10"
                          }`}
                        >
                          ★
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                            ROLE_COLORS[player.role]
                          }`}
                        >
                          {ROLE_LABELS[player.role]}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {player.battingStyle}
                          {player.bowlingStyle !== "-" && ` · ${player.bowlingStyle}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-800/70 pt-3">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Rating
                        </span>
                        <span className="font-mono font-black text-lg text-slate-100">
                          {player.rating}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                          style={{ width: `${player.rating}%` }}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {tab !== "squad" && (
          <>
            {matches === null && (
              <EmptyCard text="Loading your match history…" />
            )}
            {matches !== null && needsAccount && (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-slate-300 mb-3">
                  Sign in to see the figures from your own scored matches.
                </p>
                <Link
                  href="/login?next=/players"
                  className="inline-block rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 hover:scale-[1.02] transition-all"
                >
                  Sign in
                </Link>
              </div>
            )}
            {matches !== null &&
              !needsAccount &&
              (tab === "batting" ? (
                batting.length === 0 ? (
                  <EmptyCard text="No batting figures yet — score a match to fill this table." />
                ) : (
                  <BattingTable rows={batting} />
                )
              ) : bowling.length === 0 ? (
                <EmptyCard text="No bowling figures yet — score a match to fill this table." />
              ) : (
                <BowlingTable rows={bowling} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
      {text}
    </div>
  );
}

function BattingTable({ rows }: { rows: BattingStats[] }) {
  return (
    <div className="glass rounded-2xl p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <th className="text-left font-semibold py-2 pr-2">Batter</th>
            <th className="text-right font-semibold py-2 px-2">Inn</th>
            <th className="text-right font-semibold py-2 px-2">Runs</th>
            <th className="text-right font-semibold py-2 px-2">HS</th>
            <th className="text-right font-semibold py-2 px-2">Avg</th>
            <th className="text-right font-semibold py-2 px-2">SR</th>
            <th className="text-right font-semibold py-2 px-2">4s</th>
            <th className="text-right font-semibold py-2 pl-2">6s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const average = battingAverage(row);
            return (
              <tr key={row.name} className="border-b border-slate-800/50">
                <td className="py-2 pr-2 font-medium whitespace-nowrap">
                  {row.name}
                  {row.fifties > 0 && (
                    <span className="ml-2 text-[10px] text-emerald-400">
                      {row.hundreds > 0 && `${row.hundreds}×100 `}
                      {row.fifties}×50
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-400">
                  {row.innings}
                </td>
                <td className="py-2 px-2 text-right font-mono font-bold">
                  {row.runs}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {row.highScore}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {average === null ? "—" : average.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {strikeRate(row).toFixed(0)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-400">
                  {row.fours}
                </td>
                <td className="py-2 pl-2 text-right font-mono text-slate-400">
                  {row.sixes}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BowlingTable({ rows }: { rows: BowlingStats[] }) {
  return (
    <div className="glass rounded-2xl p-5 overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <th className="text-left font-semibold py-2 pr-2">Bowler</th>
            <th className="text-right font-semibold py-2 px-2">Inn</th>
            <th className="text-right font-semibold py-2 px-2">Ov</th>
            <th className="text-right font-semibold py-2 px-2">Runs</th>
            <th className="text-right font-semibold py-2 px-2">Wkts</th>
            <th className="text-right font-semibold py-2 px-2">Best</th>
            <th className="text-right font-semibold py-2 px-2">Econ</th>
            <th className="text-right font-semibold py-2 pl-2">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const average = bowlingAverage(row);
            const overs = `${Math.floor(row.balls / 6)}.${row.balls % 6}`;
            return (
              <tr key={row.name} className="border-b border-slate-800/50">
                <td className="py-2 pr-2 font-medium whitespace-nowrap">
                  {row.name}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-400">
                  {row.innings}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {overs}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-400">
                  {row.runs}
                </td>
                <td className="py-2 px-2 text-right font-mono font-bold">
                  {row.wickets}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {row.bestWickets}/{row.bestRuns}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {economy(row).toFixed(2)}
                </td>
                <td className="py-2 pl-2 text-right font-mono text-slate-300">
                  {average === null ? "—" : average.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
