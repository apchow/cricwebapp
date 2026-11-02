"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/toast";
import type { PublicXI } from "@/lib/dto";
import { useToast } from "@/lib/client";
import {
  PLAYERS,
  Player,
  PlayerRole,
  ROLE_LABELS,
  ROLE_COLORS,
  COUNTRIES,
} from "@/data/players";

/* ─── Constants ────────────────────────────────────────── */
const MAX_XI = 11;
const ROLES: PlayerRole[] = ["BAT", "BOWL", "AR", "WK"];

/* ─── Component ─────────────────────────────────────────── */
export default function XIBuilderPage() {
  /* ── state ── */
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<PlayerRole | "ALL">("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [email, setEmail] = useState<string | null>(null);
  const [savedXis, setSavedXis] = useState<PublicXI[]>([]);
  const [xiName, setXiName] = useState("");
  const [saving, setSaving] = useState(false);

  const { message: toast, notify: flash } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const meResponse = await fetch("/api/auth/me");
        const me = (await meResponse.json()) as {
          user?: { email: string } | null;
        };
        if (cancelled || !me.user) return;
        setEmail(me.user.email);
        const xisResponse = await fetch("/api/xis");
        const xis = (await xisResponse.json()) as { xis?: PublicXI[] };
        if (!cancelled && Array.isArray(xis.xis)) setSavedXis(xis.xis);
      } catch {
        if (!cancelled) flash("Could not reach the server");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [flash]);

  /* ── derived data ── */
  const selectedPlayers: Player[] = useMemo(
    () =>
      selected
        .map((id) => PLAYERS.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p)),
    [selected]
  );

  const filteredPlayers = useMemo(() => {
    return PLAYERS.filter((p) => {
      if (roleFilter !== "ALL" && p.role !== roleFilter) return false;
      if (countryFilter !== "ALL" && p.country !== countryFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [roleFilter, countryFilter, search]);

  /* ── validation ── */
  const wkCount = selectedPlayers.filter((p) => p.role === "WK").length;
  const bowlOptions = selectedPlayers.filter(
    (p) => p.role === "BOWL" || p.role === "AR"
  ).length;
  const batOptions = selectedPlayers.filter(
    (p) => p.role === "BAT" || p.role === "WK"
  ).length;

  const rules = [
    { label: "At least 1 Wicket-Keeper", pass: wkCount >= 1 },
    { label: "At least 4 bowling options (BOWL + AR)", pass: bowlOptions >= 4 },
    { label: "At least 4 specialist batsmen (BAT + WK)", pass: batOptions >= 4 },
    { label: "Exactly 11 players selected", pass: selectedPlayers.length === MAX_XI },
  ];

  const allValid = rules.every((r) => r.pass);

  /* ── actions ── */
  function addPlayer(id: number) {
    if (selected.length >= MAX_XI || selected.includes(id)) return;
    setSelected((prev) => [...prev, id]);
  }

  function removePlayer(id: number) {
    setSelected((prev) => prev.filter((value) => value !== id));
  }

  function movePlayer(index: number, direction: -1 | 1) {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function shareXI() {
    if (!allValid) return;
    const lines = selectedPlayers.map(
      (p, i) => `${i + 1}. ${p.flag} ${p.name} (${ROLE_LABELS[p.role]})`
    );
    const text = `🏏 My CricHub XI\n${"─".repeat(24)}\n${lines.join("\n")}\n${"─".repeat(24)}\nBuilt on CricHub`;
    navigator.clipboard
      .writeText(text)
      .then(() => flash("Copied to clipboard"))
      .catch(() => flash("Could not copy"));
  }

  async function saveXI() {
    if (!allValid) return;
    if (!email) {
      flash("Sign in to save your XI");
      return;
    }
    const name = xiName.trim() || `${selectedPlayers[0]?.name ?? "My"} XI`;
    setSaving(true);
    try {
      const response = await fetch("/api/xis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, players: selected }),
      });
      if (!response.ok) {
        flash("Could not save this XI");
        return;
      }
      const data = (await response.json()) as { xi?: PublicXI };
      if (data.xi) setSavedXis((prev) => [data.xi as PublicXI, ...prev]);
      setXiName("");
      flash("XI saved to your account");
    } catch {
      flash("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  function loadXI(xi: PublicXI) {
    const ids = xi.players.filter((id) => PLAYERS.some((p) => p.id === id));
    setSelected(ids);
    flash(`Loaded “${xi.name}”`);
  }

  function removeXI(id: string) {
    setSavedXis((prev) => prev.filter((xi) => xi.id !== id));
    fetch(`/api/xis/${id}`, { method: "DELETE" }).catch(() => null);
  }

  /* ── render helpers ── */
  const emptySlots = MAX_XI - selectedPlayers.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toast message={toast} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Hero ── */}
        <section className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-green-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            Build Your XI
          </h1>
          <p className="mt-3 text-slate-400 text-lg max-w-xl mx-auto">
            Hand-pick the ultimate playing eleven from 40 world-class cricketers.
            Filter, select, validate — then share your dream team.
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {selectedPlayers.length}/{MAX_XI} selected
            </span>
            {allValid && (
              <span className="flex items-center gap-1 text-green-400 font-medium">
                ✓ Valid XI
              </span>
            )}
          </div>
        </section>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ─── Player Pool (left 60%) ─── */}
          <div className="lg:col-span-3 glass rounded-2xl p-6 flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🏏</span> Player Pool
              <span className="ml-auto text-xs text-slate-500 font-normal">
                {filteredPlayers.length} players
              </span>
            </h2>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                />
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as PlayerRole | "ALL")
                }
                className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>

              {/* Country filter */}
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition cursor-pointer"
              >
                <option value="ALL">All Countries</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Player grid */}
            <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
              {filteredPlayers.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                  No players match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPlayers.map((player) => {
                    const isSelected = selected.includes(player.id);
                    const isFull = selected.length >= MAX_XI;
                    const disabled = isSelected || isFull;

                    return (
                      <button
                        key={player.id}
                        onClick={() => addPlayer(player.id)}
                        disabled={disabled}
                        className={`group relative text-left rounded-xl border p-3 transition-all duration-200 ${
                          isSelected
                            ? "bg-green-500/10 border-green-500/30 opacity-60 cursor-not-allowed"
                            : isFull
                            ? "bg-slate-800/40 border-slate-700/30 opacity-40 cursor-not-allowed"
                            : "bg-slate-800/40 border-slate-700/30 hover:border-indigo-500/50 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-green-400 text-xs">✓</span>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <span className="text-2xl leading-none mt-0.5">
                            {player.flag}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-100 truncate">
                              {player.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[player.role]}`}
                              >
                                {ROLE_LABELS[player.role]}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {player.country}
                              </span>
                            </div>
                            {/* Rating bar */}
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-400 transition-all duration-500"
                                  style={{ width: `${player.rating}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono w-6 text-right">
                                {player.rating}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Selected XI + Validation (right 40%) ─── */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Selected XI */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">⭐</span> Your XI
                <span className="ml-auto text-xs font-mono text-slate-500">
                  {selectedPlayers.length}/{MAX_XI}
                </span>
              </h2>

              <div className="space-y-2">
                {selectedPlayers.map((player, idx) => (
                  <div
                    key={player.id}
                    className="group flex items-center gap-3 bg-slate-800/50 border border-slate-700/30 rounded-lg px-3 py-2 transition-all duration-200 hover:border-red-500/30"
                  >
                    <span className="text-xs text-slate-500 font-mono w-5 text-center">
                      {idx + 1}
                    </span>
                    <span className="text-lg leading-none">{player.flag}</span>
                    <span className="flex-1 text-sm font-medium text-slate-200 truncate">
                      {player.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[player.role]}`}
                    >
                      {player.role}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => movePlayer(idx, -1)}
                        disabled={idx === 0}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                        aria-label={`Move ${player.name} up the order`}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => movePlayer(idx, 1)}
                        disabled={idx === selectedPlayers.length - 1}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                        aria-label={`Move ${player.name} down the order`}
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label={`Remove ${player.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center border-2 border-dashed border-slate-700/40 rounded-lg px-3 py-2 h-[42px]"
                  >
                    <span className="text-xs text-slate-600">
                      Slot {selectedPlayers.length + i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Validation Panel ── */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">📋</span> Validation
              </h2>
              <ul className="space-y-2">
                {rules.map((rule) => (
                  <li
                    key={rule.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        rule.pass
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {rule.pass ? "✓" : "✕"}
                    </span>
                    <span
                      className={
                        rule.pass ? "text-slate-300" : "text-slate-400"
                      }
                    >
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Share Button ── */}
            <button
              onClick={shareXI}
              disabled={!allValid}
              className={`w-full rounded-xl py-3.5 font-bold text-sm tracking-wide transition-all duration-300 ${
                allValid
                  ? "bg-gradient-to-r from-green-500 to-indigo-500 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  : "bg-slate-800 text-slate-500 border border-slate-700/40 cursor-not-allowed"
              }`}
            >
              {allValid ? "🚀 Share Your XI" : "Complete your XI to share"}
            </button>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">☁️</span> Saved XIs
              </h2>

              {email ? (
                <p className="text-[11px] text-slate-500 mb-4">
                  Signed in as {email}
                </p>
              ) : (
                <p className="text-xs text-slate-400 mb-4">
                  <Link
                    href="/login?next=/xi-builder"
                    className="text-indigo-300 underline"
                  >
                    Sign in
                  </Link>{" "}
                  to store your XIs on your account.
                </p>
              )}

              {email && (
                <div className="flex gap-2 mb-4">
                  <input
                    value={xiName}
                    onChange={(event) => setXiName(event.target.value)}
                    placeholder="Name this XI"
                    maxLength={40}
                    className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <button
                    onClick={saveXI}
                    disabled={!allValid || saving}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}

              {savedXis.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing saved yet.</p>
              ) : (
                <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {savedXis.map((xi) => (
                    <li
                      key={xi.id}
                      className="flex items-center gap-2 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {xi.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {xi.players.length} players ·{" "}
                          {new Date(xi.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => loadXI(xi)}
                        className="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/25 transition-all"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => removeXI(xi.id)}
                        aria-label={`Delete ${xi.name}`}
                        className="w-6 h-6 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
