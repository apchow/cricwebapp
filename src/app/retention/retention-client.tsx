"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, Lock, Search, Share2, Star, Trash2, X } from "lucide-react";

import TeamBadge from "@/components/team-badge";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import { flagOf } from "@/lib/flags";
import { crores } from "@/data/player-db";
import { ACTIVE_PLAYERS } from "@/data/player-db";
import { TEAMS, teamMeta } from "@/data/teams";
import {
  RETENTION_RULES,
  TOTAL_PURSE,
  type IplTeam,
  type Player,
  type PlayerRole,
} from "@/types/player";

const STORE_KEY = "pavilion.retention.v16";
const ROLES: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];

type Feasibility = { ok: boolean; reason?: string };

function feasibility(roster: Player[], player: Player): Feasibility {
  if (roster.some((item) => item.id === player.id)) {
    return { ok: false, reason: "Already in your retentions" };
  }
  if (roster.length >= RETENTION_RULES.max) {
    return { ok: false, reason: `All ${RETENTION_RULES.max} slots are full` };
  }
  const capped = roster.filter((item) => !item.isUncapped).length;
  const uncapped = roster.filter((item) => item.isUncapped).length;
  const left = RETENTION_RULES.max - (roster.length + 1);

  if (player.isUncapped) {
    if (capped + left < RETENTION_RULES.minCapped) {
      return {
        ok: false,
        reason: `You would fall short of ${RETENTION_RULES.minCapped} capped players`,
      };
    }
  } else if (uncapped + left < RETENTION_RULES.minUncapped) {
    return {
      ok: false,
      reason: `You would fall short of ${RETENTION_RULES.minUncapped} uncapped players`,
    };
  }
  return { ok: true };
}

export default function RetentionClient() {
  const [team, setTeam] = useState<IplTeam | "ALL">("ALL");
  const [role, setRole] = useState<PlayerRole | "ALL">("ALL");
  const [uncappedOnly, setUncappedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [rosterIds, setRosterIds] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const { message, notify } = useToast();

  useEffect(() => {
    const stored = readLocal(STORE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { roster?: number[] };
      if (Array.isArray(parsed.roster)) {
        setRosterIds(parsed.roster.filter((id) => typeof id === "number"));
      }
    } catch {
      /* ignore a corrupt saved roster */
    }
  }, []);

  useEffect(() => {
    writeLocal(STORE_KEY, JSON.stringify({ roster: rosterIds }));
  }, [rosterIds]);

  const roster = useMemo(
    () =>
      rosterIds
        .map((id) => ACTIVE_PLAYERS.find((player) => player.id === id))
        .filter((player): player is Player => Boolean(player)),
    [rosterIds]
  );

  const capped = roster.filter((player) => !player.isUncapped).length;
  const uncapped = roster.filter((player) => player.isUncapped).length;
  const spent = roster.reduce((sum, player) => sum + player.basePrice, 0);
  const complete =
    roster.length === RETENTION_RULES.max &&
    capped >= RETENTION_RULES.minCapped &&
    uncapped >= RETENTION_RULES.minUncapped;

  const pool = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ACTIVE_PLAYERS.filter((player) => {
      if (team !== "ALL" && player.team !== team) return false;
      if (role !== "ALL" && player.role !== role) return false;
      if (uncappedOnly && !player.isUncapped) return false;
      if (needle && !player.name.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => b.form - a.form || b.basePrice - a.basePrice);
  }, [team, role, uncappedOnly, query]);

  function retain(player: Player) {
    const check = feasibility(roster, player);
    if (!check.ok) {
      notify(check.reason ?? "Not available");
      return;
    }
    setRosterIds((prev) => [...prev, player.id]);
    setLocked(false);
  }

  function drop(id: number) {
    setRosterIds((prev) => prev.filter((item) => item !== id));
    setLocked(false);
  }

  const warnings: string[] = [];
  if (roster.length < RETENTION_RULES.max) {
    warnings.push(
      `${RETENTION_RULES.max - roster.length} slot${
        RETENTION_RULES.max - roster.length === 1 ? "" : "s"
      } still open`
    );
  }
  if (capped < RETENTION_RULES.minCapped) {
    warnings.push(
      `${RETENTION_RULES.minCapped - capped} more capped player${
        RETENTION_RULES.minCapped - capped === 1 ? "" : "s"
      } needed`
    );
  }
  if (uncapped < RETENTION_RULES.minUncapped) {
    warnings.push(
      `${RETENTION_RULES.minUncapped - uncapped} more uncapped player${
        RETENTION_RULES.minUncapped - uncapped === 1 ? "" : "s"
      } needed`
    );
  }

  async function share() {
    const lines = roster.map(
      (player) => `${player.name} (${player.team}) — ${crores(player.basePrice)}`
    );
    const text = `Pavilion XI · Retention 2027\n${lines.join(
      "\n"
    )}\nTotal: ${crores(spent)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Retention 2027", text });
      } else {
        await navigator.clipboard.writeText(text);
        notify("Squad copied to clipboard");
      }
    } catch {
      notify("Sharing cancelled");
    }
  }

  return (
    <div className="relative">
      {/* Team filter rail */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Filter by franchise
          </h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setTeam("ALL")}
            className={`shrink-0 rounded-2xl px-4 py-3 border text-xs font-bold transition-all ${
              team === "ALL"
                ? "border-slate-400/60 bg-white/10 text-white"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
            }`}
          >
            All 10 teams
          </button>
          {TEAMS.map((meta) => {
            const selected = team === meta.id;
            return (
              <button
                key={meta.id}
                onClick={() => setTeam(meta.id)}
                aria-pressed={selected}
                className={`shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${
                  selected
                    ? `${meta.ring} bg-white/10`
                    : "border-slate-800 bg-slate-900/60 hover:bg-slate-900"
                }`}
              >
                <TeamBadge team={meta.id} size={34} active={selected} />
                <span className="text-left leading-tight">
                  <span className="block text-xs font-black text-slate-100">
                    {meta.short}
                  </span>
                  <span className="block text-[10px] text-slate-500 whitespace-nowrap">
                    {meta.city}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Pool */}
        <div>
          <div className="glass rounded-2xl p-4 mb-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a player…"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRole("ALL")}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  role === "ALL"
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                All roles
              </button>
              {ROLES.map((item) => (
                <button
                  key={item}
                  onClick={() => setRole(item)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    role === item
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
              <button
                onClick={() => setUncappedOnly((value) => !value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  uncappedOnly
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Uncapped only
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-3">{pool.length} players</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pool.map((player) => {
              const check = feasibility(roster, player);
              const retained = rosterIds.includes(player.id);
              const meta = teamMeta(player.team);
              return (
                <motion.article
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative rounded-2xl border p-3.5 transition-all ${
                    retained
                      ? "border-emerald-500/50 bg-emerald-500/[0.07]"
                      : "border-slate-800/70 bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm truncate">
                        {player.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 truncate">
                        {flagOf(player.country)} {player.country} · {player.role}
                      </p>
                    </div>
                    <TeamBadge team={player.team} size={30} active={retained} />
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    {player.isUncapped && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                        Uncapped
                      </span>
                    )}
                    {player.era === "modern" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold uppercase">
                        Modern
                      </span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                      {player.punditTag}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    <Metric label="Form" value={player.form} />
                    <Metric label="PP" value={player.ppImpact} />
                    <Metric label="Death" value={player.deathImpact} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {crores(player.basePrice)}
                    </span>
                    {retained ? (
                      <button
                        onClick={() => drop(player.id)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Drop
                      </button>
                    ) : (
                      <button
                        onClick={() => retain(player)}
                        disabled={!check.ok}
                        title={check.reason}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Retain
                      </button>
                    )}
                  </div>

                  {!check.ok && !retained && check.reason && (
                    <p className="mt-2 text-[10px] text-red-400/90 leading-snug">
                      {check.reason}
                    </p>
                  )}
                  {meta === null && null}
                </motion.article>
              );
            })}
          </div>
        </div>

        {/* Roster panel */}
        <aside className="lg:sticky lg:top-20 self-start">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Retention 2027
              </h2>
              <span className="font-mono text-xs text-slate-400">
                {roster.length}/{RETENTION_RULES.max}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="Capped" value={`${capped}/${RETENTION_RULES.minCapped}`} ok={capped >= RETENTION_RULES.minCapped} />
              <Stat label="Uncapped" value={`${uncapped}/${RETENTION_RULES.minUncapped}`} ok={uncapped >= RETENTION_RULES.minUncapped} />
              <Stat label="Spent" value={crores(spent)} ok />
            </div>

            <div className="space-y-2 mb-4">
              {Array.from({ length: RETENTION_RULES.max }).map((_, index) => {
                const player = roster[index];
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 min-h-[52px] ${
                      player
                        ? "border-slate-700/70 bg-slate-900/60"
                        : "border-dashed border-slate-800 bg-slate-900/30"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-slate-600 w-4">
                      {index + 1}
                    </span>
                    {player ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">
                            {player.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {player.team} · {crores(player.basePrice)}
                            {player.isUncapped ? " · uncapped" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => drop(player.id)}
                          aria-label={`Drop ${player.name}`}
                          className="shrink-0 w-6 h-6 grid place-items-center rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-600">
                        Empty slot
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {warnings.length > 0 ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/[0.07] p-3 mb-4">
                <p className="text-[11px] font-bold text-red-300 mb-1.5">
                  Roster is not valid yet
                </p>
                <ul className="space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning} className="text-[11px] text-red-200/90 flex gap-1.5">
                      <span>•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <p className="text-[11px] font-bold text-emerald-200">
                  Rules satisfied — 4 capped + 2 uncapped
                </p>
              </div>
            )}

            <button
              onClick={() => setLocked(true)}
              disabled={!complete}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.01] disabled:opacity-35 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all"
            >
              <Lock className="w-4 h-4" />
              Lock Roster
            </button>
            {roster.length > 0 && (
              <button
                onClick={() => {
                  setRosterIds([]);
                  setLocked(false);
                  notify("Roster cleared");
                }}
                className="w-full mt-2 rounded-xl py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition-all"
              >
                Clear all
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-600 mt-3 px-1 leading-relaxed">
            Purse remaining {crores(TOTAL_PURSE - spent)} of {crores(TOTAL_PURSE)}
          </p>
        </aside>
      </div>

      <AnimatePresence>
        {locked && complete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setLocked(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl p-px bg-gradient-to-br from-emerald-400/70 via-white/20 to-teal-500/60"
            >
              <div className="rounded-[23px] bg-slate-950/90 backdrop-blur-2xl p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80 font-bold mb-1">
                      Retained squad
                    </p>
                    <h3 className="text-2xl font-black tracking-tight">
                      Locked &amp; Loaded
                    </h3>
                  </div>
                  <button
                    onClick={() => setLocked(false)}
                    aria-label="Close"
                    className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 mb-5">
                  {roster.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-white/[0.04] px-3 py-2.5"
                    >
                      <span className="font-mono text-[10px] text-slate-500 w-4">
                        {index + 1}
                      </span>
                      <TeamBadge team={player.team} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">
                          {player.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {player.role}
                          {player.isUncapped ? " · uncapped" : ""}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-300">
                        {crores(player.basePrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-4 mb-5">
                  <span className="text-xs text-slate-400">
                    {roster.length} players · 4 capped + 2 uncapped
                  </span>
                  <span className="font-mono font-black text-lg">
                    {crores(spent)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={share}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.01] transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    Share squad
                  </button>
                  <button
                    onClick={() => setLocked(false)}
                    className="rounded-xl px-4 py-3 text-sm font-bold text-slate-300 bg-slate-900/70 border border-slate-800 hover:bg-slate-900 transition-all"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl px-4 py-2.5 text-sm font-semibold bg-slate-900/95 border border-slate-700 shadow-xl"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900/70 border border-slate-800/70 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div className="text-xs font-mono font-bold text-slate-200">{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-2.5 py-2 ${
        ok
          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
          : "border-red-500/25 bg-red-500/[0.06]"
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div
        className={`text-xs font-mono font-bold ${
          ok ? "text-emerald-200" : "text-red-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
