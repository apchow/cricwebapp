"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import TeamBadge from "@/components/team-badge";
import Toast from "@/components/toast";
import ToolHeader from "@/components/tool-header";
import { BattingTable, BowlingTable } from "@/components/stat-tables";
import { crores, PLAYERS, PLAYER_UPDATED, PLAYER_VERSION } from "@/data/player-db";
import { TEAMS } from "@/data/teams";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import { flagOf } from "@/lib/flags";
import { battingStats, bowlingStats } from "@/lib/stats";
import type { PublicMatch } from "@/lib/dto";
import type { Player, PlayerRole, PunditTag } from "@/types/player";

const FAVOURITES_KEY = "pavilion.favourites.v1";

type Tab = "squad" | "batting" | "bowling";
type Sort = "form" | "vfm" | "price" | "name";

const ROLES: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];

const ROLE_STYLE: Record<PlayerRole, string> = {
  Batter: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  Bowler: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  "All-Rounder": "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  "Wicket-Keeper": "border-amber-500/40 bg-amber-500/10 text-amber-200",
};

const TAG_STYLE: Record<PunditTag, string> = {
  Marquee: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  Steal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  Watchlist: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  Solid: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  Punt: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  Overpriced: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const SORTS: { id: Sort; label: string }[] = [
  { id: "form", label: "Form" },
  { id: "vfm", label: "Value" },
  { id: "price", label: "Price" },
  { id: "name", label: "Name" },
];

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          {label}
        </span>
        <span className="text-xs font-mono font-bold text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  favourite,
  onToggle,
}: {
  player: Player;
  favourite: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-2xl bg-slate-900/90 border border-slate-800/60 p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{flagOf(player.country)}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {player.country}
            </span>
          </div>
          <Link
            href={`/players/${player.id}`}
            className="block font-bold truncate mt-0.5 hover:text-sky-200 transition-colors"
          >
            {player.name}
          </Link>
        </div>
        <button
          onClick={onToggle}
          aria-label={
            favourite
              ? `Remove ${player.name} from favourites`
              : `Add ${player.name} to favourites`
          }
          className={`w-7 h-7 shrink-0 rounded-lg text-sm transition-all ${
            favourite
              ? "text-amber-300 bg-amber-500/15"
              : "text-slate-600 hover:text-amber-300 hover:bg-amber-500/10"
          }`}
        >
          ★
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
            ROLE_STYLE[player.role]
          }`}
        >
          {player.role}
        </span>
        {player.team === "FREE AGENT" ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-600/50 bg-slate-700/20 text-slate-300 font-bold uppercase tracking-wider">
            {player.era === "legend" ? "Legend" : "Free agent"}
          </span>
        ) : (
          <TeamBadge team={player.team} size={20} />
        )}
        {player.isUncapped && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-200 font-bold uppercase tracking-wider">
            Uncapped
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        <Meter label="Form" value={player.form} />
        <Meter label="Value" value={player.vfm} />
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/70 mt-3 pt-3">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
            TAG_STYLE[player.punditTag]
          }`}
        >
          {player.punditTag}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-black text-slate-100">
            {crores(player.basePrice)}
          </span>
          <Link
            href={`/players/${player.id}`}
            aria-label={`View ${player.name}'s profile`}
            className="text-xs font-bold text-slate-500 hover:text-sky-200 transition-colors"
          >
            Profile →
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function PlayersClient() {
  const [tab, setTab] = useState<Tab>("squad");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("ALL");
  const [role, setRole] = useState<PlayerRole | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("form");
  const [activeOnly, setActiveOnly] = useState(true);
  const [uncappedOnly, setUncappedOnly] = useState(false);
  const [favourites, setFavourites] = useState<number[]>([]);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [matches, setMatches] = useState<PublicMatch[] | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);

  const { message: toast, notify } = useToast();

  useEffect(() => {
    const stored = readLocal(FAVOURITES_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        setFavourites(parsed.filter((id): id is number => typeof id === "number"));
      }
    } catch {
      /* ignore malformed favourites */
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
    notify("Favourites updated");
  }

  const squad = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PLAYERS.filter((player) => {
      if (activeOnly && !player.isActive) return false;
      if (team !== "ALL" && player.team !== team) return false;
      if (role !== "ALL" && player.role !== role) return false;
      if (uncappedOnly && !player.isUncapped) return false;
      if (onlyFavourites && !favourites.includes(player.id)) return false;
      if (
        needle &&
        !player.name.toLowerCase().includes(needle) &&
        !player.country.toLowerCase().includes(needle) &&
        !player.team.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "price") return b.basePrice - a.basePrice;
      if (sort === "vfm") return b.vfm - a.vfm || b.form - a.form;
      return b.form - a.form || b.vfm - a.vfm;
    });
  }, [query, team, role, sort, activeOnly, uncappedOnly, onlyFavourites, favourites]);

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

  const activeFilters =
    team !== "ALL" ||
    role !== "ALL" ||
    uncappedOnly ||
    onlyFavourites ||
    !activeOnly;

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
          title="Stats Hub"
          blurb={`Every player, every figure — filter the ${PLAYERS.length}-player database by franchise, role and price, or dig into the numbers from your own scored matches.`}
          gradient="from-sky-300 via-cyan-200 to-violet-300"
        />

        <div className="glass rounded-2xl p-4 sm:p-5 mb-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                ["squad", "Squad database"],
                ["batting", "My batting"],
                ["bowling", "My bowling"],
              ] as const
            ).map(([id, label]) => (
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
              tab === "squad"
                ? "Search a player, country or franchise…"
                : "Search a name…"
            }
            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />

          {tab === "squad" && (
            <>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-3">
                <button
                  onClick={() => setTeam("ALL")}
                  className={`shrink-0 px-3 h-[38px] rounded-xl text-xs font-bold border transition-all ${
                    team === "ALL"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  All 10 teams
                </button>
                {TEAMS.map((meta) => (
                  <button
                    key={meta.id}
                    onClick={() => setTeam(meta.id)}
                    aria-pressed={team === meta.id}
                    aria-label={meta.name}
                    className="shrink-0 rounded-xl transition-transform hover:scale-105"
                  >
                    <TeamBadge
                      team={meta.id}
                      size={38}
                      active={team === meta.id}
                      glyph={meta.logo}
                    />
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["ALL", ...ROLES] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      role === item
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {item === "ALL" ? "All roles" : item}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5">
                  {SORTS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSort(option.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        sort === option.id
                          ? "bg-sky-500/20 border-sky-500/40 text-sky-200"
                          : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveOnly((value) => !value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    activeOnly
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Active only
                </button>
                <button
                  onClick={() => setUncappedOnly((value) => !value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    uncappedOnly
                      ? "bg-teal-500/20 border-teal-500/40 text-teal-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Uncapped
                </button>
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
                      setTeam("ALL");
                      setRole("ALL");
                      setUncappedOnly(false);
                      setOnlyFavourites(false);
                      setActiveOnly(true);
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
              {squad.length} of {PLAYERS.length} players · data v{PLAYER_VERSION}{" "}
              updated {PLAYER_UPDATED}
            </p>
            {squad.length === 0 ? (
              <EmptyCard text="No players match those filters." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {squad.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    favourite={favourites.includes(player.id)}
                    onToggle={() => toggleFavourite(player.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab !== "squad" && (
          <>
            {matches === null && <EmptyCard text="Loading your match history…" />}
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
