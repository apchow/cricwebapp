"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Check,
  Copy,
  FastForward,
  Gavel,
  Globe,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { formatCr, type OfficialTeam } from "@/lib/auction/data.ts";
import { buildPool } from "@/lib/auction/official.ts";
import {
  clampPrice,
  customPlan,
  officialPlan,
  rosterFor,
  suggestCustom,
  type RetentionPlan,
} from "@/lib/auction/plan.ts";
import { AuctionEngine, nextBidCr } from "@/lib/auction/engine.ts";
import { isMuted, later, onMuteChange, setMuted, sfx, stopAllSounds, unlockAudio } from "@/lib/game-sound";

type Stage = "retention" | "live" | "results";

function RoleChip({ role }: { role: string }) {
  return (
    <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-300">
      {role}
    </span>
  );
}

function PlayerBadges({ p }: { p: { overseas: boolean; uncapped: boolean; country: string } }) {
  return (
    <>
      <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">
        {p.country}
      </span>
      {p.overseas && (
        <span className="inline-flex items-center gap-0.5 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-300">
          <Globe className="h-2.5 w-2.5" /> Overseas
        </span>
      )}
      {p.uncapped && (
        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">
          Uncapped
        </span>
      )}
    </>
  );
}

function StatTile({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "plain" | "sky" }) {
  const color =
    tone === "gold"
      ? "bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent"
      : tone === "sky"
        ? "text-sky-300"
        : "text-white";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
      <div className={`text-xl font-black tabular-nums leading-none ${color}`}>{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}

export default function AuctionExperience({
  team,
  teams,
  initialMode,
}: {
  team: OfficialTeam;
  teams: OfficialTeam[];
  initialMode: "official" | "custom";
}) {
  const [stage, setStage] = useState<Stage>("retention");
  const [mode, setMode] = useState<"official" | "custom">(initialMode);
  // Deterministic on server AND first client render (no localStorage read during
  // hydration, which would mismatch the SSR HTML). Saved picks load post-mount.
  const [picks, setPicks] = useState<Record<string, number>>(() =>
    Object.fromEntries(suggestCustom(team).map((p) => [p.playerId, p.priceCr]))
  );
  const [picksReady, setPicksReady] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const engineRef = useRef<AuctionEngine | null>(null);
  const lastTickSec = useRef(-1);
  const storageKey = `pundit-arena:auction-keep:${team.id}`;

  useEffect(() => {
    setMutedState(isMuted());
    const off = onMuteChange(setMutedState);
    // Leaving the page (nav, back, close) must never leave auction audio ringing.
    return () => {
      off();
      stopAllSounds();
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setPicks(JSON.parse(saved) as Record<string, number>);
    } catch {
      /* private mode etc. */
    }
    setPicksReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!picksReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(picks));
    } catch {
      /* ignore */
    }
  }, [picks, picksReady, storageKey]);

  const plan: RetentionPlan = useMemo(() => {
    if (mode === "official") return officialPlan(team);
    return customPlan(
      team,
      Object.entries(picks).map(([playerId, priceCr]) => ({ playerId, priceCr }))
    );
  }, [mode, team, picks]);

  const poolSize = useMemo(
    () => buildPool(team.id, new Set(plan.retained.map((p) => p.id))).length,
    [team.id, plan]
  );

  function toggleMute() {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.ui();
  }

  function startAuction() {
    unlockAudio();
    sfx.start();
    const pool = buildPool(team.id, new Set(plan.retained.map((p) => p.id)));
    engineRef.current = new AuctionEngine({
      userTeamId: team.id,
      plan,
      teams,
      pool,
      seed: Date.now() % 2147483647,
    });
    lastTickSec.current = -1;
    setStage("live");
  }

  function leaveRoom() {
    stopAllSounds();
    engineRef.current = null;
    setStage("retention");
  }

  function skipToEnd() {
    const e = engineRef.current;
    if (!e) return;
    e.finishNow();
    sfx.fanfare();
    setStage("results");
  }

  // The auction clock. One interval drives the engine, sounds and re-render.
  useEffect(() => {
    if (stage !== "live") return;
    const id = setInterval(() => {
      const e = engineRef.current;
      if (!e) { clearInterval(id); return; }
      e.tick(200);
      for (const ev of e.drainEvents()) {
        if (ev.type === "bid") sfx.bid();
        else if (ev.type === "user-bid") sfx.userBid();
        else if (ev.type === "sold") {
          sfx.hammer();
          if (ev.teamId === e.userTeamId) later(() => sfx.sold(), 160);
        } else if (ev.type === "unsold") sfx.unsold();
        else if (ev.type === "end") sfx.fanfare();
      }
      if (e.lot.phase === "countdown") {
        const sec = Math.ceil(e.lot.countdownMs / 1000);
        if (sec !== lastTickSec.current) {
          lastTickSec.current = sec;
          sfx.tick();
        }
      } else {
        lastTickSec.current = -1;
      }
      if (e.phase === "done") setStage("results");
      force();
    }, 200);
    return () => clearInterval(id);
  }, [stage]);

  const engine = engineRef.current;

  // ---------------------------------------------------------------- retention
  if (stage === "retention") {
    const roster = rosterFor(team);
    return (
      <div className="space-y-5">
        <div className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase"
                style={{ borderColor: team.color + "50", color: team.color, backgroundColor: team.color + "12" }}
              >
                {team.short}
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">{team.name}</h1>
                <p className="text-xs text-slate-500">Retention room · IPL 2027 mini auction</p>
              </div>
            </div>
            <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1" role="tablist" aria-label="Retention mode">
              {(
                [
                  { id: "official", label: "Official", icon: BadgeCheck },
                  { id: "custom", label: "Choose yours", icon: SlidersHorizontal },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => {
                    setMode(m.id);
                    sfx.ui();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    mode === m.id ? "bg-amber-400/15 text-amber-300 border border-amber-400/40" : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Auction purse" value={formatCr(plan.purseCr)} />
            <StatTile label="Slots to fill" value={String(plan.slots)} tone="plain" />
            <StatTile label="Overseas slots" value={String(plan.overseasSlots)} tone="sky" />
            <StatTile
              label={mode === "custom" ? "Retention spend" : "Players kept"}
              value={mode === "custom" ? formatCr(plan.spendCr) : String(plan.retained.length)}
              tone="plain"
            />
          </div>

          {plan.errors.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300 space-y-1" role="alert">
              {plan.errors.map((e) => <p key={e}>⛔ {e}</p>)}
            </div>
          )}
          {plan.warnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90 space-y-1">
              {plan.warnings.map((w) => <p key={w}>⚠️ {w}</p>)}
            </div>
          )}
        </div>

        {mode === "official" ? (
          <div className="glass rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-1">
                Kept — {team.retained.length} players
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Announced 17 Nov 2026. Individual salaries were not published; the purse below is official.
              </p>
              <div className="flex flex-wrap gap-2">
                {team.retained.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200">
                    {p.name}
                    <RoleChip role={p.role} />
                    {p.overseas && <Globe className="h-3 w-3 text-sky-400" />}
                    {p.uncapped && <span className="text-[9px] font-black text-emerald-400">U</span>}
                  </span>
                ))}
              </div>
            </div>

            {(team.trades.in.length > 0 || team.trades.out.length > 0) && (
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
                <span className="font-black uppercase tracking-wider text-sky-300 inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Trade window
                </span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-slate-300">
                  <p><span className="text-emerald-400 font-bold">In:</span> {team.trades.in.join(", ") || "—"}</p>
                  <p><span className="text-red-400 font-bold">Out:</span> {team.trades.out.join(", ") || "—"}</p>
                </div>
              </div>
            )}

            {team.retired.length > 0 && (
              <p className="text-xs text-slate-400 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                🏏 <span className="font-bold text-white">{team.retired.join(", ")}</span> retired from IPL — not part of the auction pool.
              </p>
            )}

            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">
                Released into the pool — {team.released.length}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {team.released.map((p) => p.name).join(" · ")}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">
                  Your retention list
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tap to keep, set the price. Purse = ₹120cr − spend · slots = 25 − kept · overseas = 8 − kept.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPicks(Object.fromEntries(suggestCustom(team).map((p) => [p.playerId, p.priceCr])));
                    sfx.ui();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Suggest a plan
                </button>
                <button
                  onClick={() => {
                    setPicks({});
                    sfx.ui();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-800 divide-y divide-slate-800/70">
              {roster.map((p) => {
                const kept = p.id in picks;
                const price = picks[p.id] ?? clampPrice(Math.min(p.valueCr, 14));
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 transition-colors ${kept ? "bg-amber-400/5" : "hover:bg-slate-800/40"}`}
                  >
                    <button
                      onClick={() => {
                        setPicks((prev) => {
                          const next = { ...prev };
                          if (kept) delete next[p.id];
                          else next[p.id] = price;
                          return next;
                        });
                        sfx.ui();
                      }}
                      aria-pressed={kept}
                      aria-label={`${kept ? "Release" : "Retain"} ${p.name}`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                        kept ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-600 text-transparent hover:border-amber-400/60"
                      }`}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-bold truncate ${kept ? "text-white" : "text-slate-300"}`}>{p.name}</span>
                        <RoleChip role={p.role} />
                        {p.overseas && <Globe className="h-3 w-3 text-sky-400" />}
                        {p.uncapped && <span className="text-[9px] font-black text-emerald-400">UNCAPPED</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        impact {p.impact} · market ~{formatCr(p.valueCr)} · {p.iplMatches} IPL games
                      </div>
                    </div>
                    {kept && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPicks((prev) => ({ ...prev, [p.id]: clampPrice(price - 0.5) }))}
                          aria-label={`Lower price for ${p.name}`}
                          className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 inline-flex items-center justify-center"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-16 text-center text-sm font-black tabular-nums text-amber-300">
                          {formatCr(price)}
                        </span>
                        <button
                          onClick={() => setPicks((prev) => ({ ...prev, [p.id]: clampPrice(price + 0.5) }))}
                          aria-label={`Raise price for ${p.name}`}
                          className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 inline-flex items-center justify-center"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            <span className="font-black text-white tabular-nums">{poolSize}</span> players will be on the block ·
            marquee set first · nine stingy rival paddles — but show interest and they'll fight you past ₹15cr
          </p>
          <button
            onClick={startAuction}
            disabled={!plan.valid}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_0_30px_-8px_rgba(245,158,11,0.7)] hover:from-amber-300 hover:to-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Gavel className="h-4 w-4" /> Enter the auction room
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- results
  if (stage === "results" && engine) {
    const u = engine.user();
    const verdict = engine.rateUserSquad();
    const squad = [...u.retained, ...u.buys.map((b) => b.player)];
    const shareText = [
      `🔨 My IPL 2027 auction squad — ${team.name}`,
      `Verdict: ${verdict.grade} (${verdict.score}/100)`,
      `Spent ${formatCr(u.spentCr)} · ${formatCr(u.purseCr)} left · ${squad.length} players`,
      u.buys.length ? `Buys: ${u.buys.map((b) => `${b.player.name} ${formatCr(b.priceCr)}`).join(", ")}` : "No buys — the rivals outbid me all day",
      `Run your own auction: ${typeof window !== "undefined" ? window.location.origin : ""}/auction/${team.id}`,
    ].join("\n");

    async function copySquad() {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        sfx.ui();
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }

    return (
      <div className="space-y-5">
        <div className="glass rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_60%)]" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Hammer down · {team.name}</p>
          <div className="mt-3 flex items-center justify-center gap-5">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(verdict.score / 100) * 264} 264`}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white tabular-nums">{verdict.score}</span>
                <span className="text-[8px] uppercase tracking-widest text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                {verdict.grade}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {verdict.bestBuy
                  ? `Best buy: ${verdict.bestBuy.player.name} at ${formatCr(verdict.bestBuy.priceCr)} (market ~${formatCr(verdict.bestBuy.player.valueCr)}).`
                  : "You kept the purse shut — the squad rides on retentions."}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 max-w-2xl mx-auto">
            <StatTile label="Auction spend" value={formatCr(u.spentCr)} />
            <StatTile label="Purse left" value={formatCr(u.purseCr)} tone="plain" />
            <StatTile label="Squad size" value={`${verdict.squadSize}/25`} tone="plain" />
            <StatTile label="Overseas / uncapped" value={`${verdict.overseas} / ${verdict.uncapped}`} tone="sky" />
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={copySquad} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied for the group chat" : "Copy my squad"}
            </button>
            <button onClick={startAuction} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-xs font-black uppercase text-slate-950 hover:from-amber-300 hover:to-amber-500 transition">
              <RotateCcw className="h-4 w-4" /> Run it back
            </button>
            <button onClick={leaveRoom} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition">
              <SlidersHorizontal className="h-4 w-4" /> Change retentions
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">
              Your final squad
            </h2>
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/70 rounded-xl border border-slate-800">
              {u.buys.map((b) => (
                <div key={b.player.id} className="flex items-center gap-2 px-3 py-2 bg-amber-400/5">
                  <Gavel className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-sm font-bold text-white flex-1 truncate">{b.player.name}</span>
                  <RoleChip role={b.player.role} />
                  {b.player.overseas && <Globe className="h-3 w-3 text-sky-400" />}
                  <span className="text-sm font-black tabular-nums text-amber-300">{formatCr(b.priceCr)}</span>
                </div>
              ))}
              {u.retained.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-300 flex-1 truncate">{p.name}</span>
                  <RoleChip role={p.role} />
                  {p.overseas && <Globe className="h-3 w-3 text-sky-400" />}
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {mode === "custom" && plan.prices[p.id] ? formatCr(plan.prices[p.id]) : "retained"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">
              Around the room
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <StatTile label="Lots sold" value={String(engine.soldCount)} tone="plain" />
              <StatTile label="Unsold" value={String(engine.unsoldCount)} tone="plain" />
              <div className="col-span-2 sm:col-span-1">
                <StatTile label="Total spend" value={formatCr(engine.totalSpendCr)} />
              </div>
            </div>
            {engine.biggestSale && (
              <p className="text-xs text-slate-300 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 mb-3">
                💰 Biggest sale: <span className="font-bold text-white">{engine.biggestSale.player.name}</span>{" "}
                to {engine.team(engine.biggestSale.teamId).short} for{" "}
                <span className="font-black text-amber-300">{formatCr(engine.biggestSale.priceCr)}</span>
              </p>
            )}
            <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800">
              {[...engine.teams]
                .sort((a, b) => b.spentCr - a.spentCr)
                .map((t) => (
                  <div key={t.id} className={`flex items-center gap-2 px-3 py-2 ${t.isUser ? "bg-amber-400/5" : ""}`}>
                    <span className="text-[10px] font-black uppercase w-12" style={{ color: t.color }}>{t.short}</span>
                    <span className="text-xs text-slate-400 flex-1 tabular-nums">{t.buys.length} buys</span>
                    <span className="text-xs font-bold tabular-nums text-slate-200">{formatCr(t.spentCr)}</span>
                    <span className="text-[10px] tabular-nums text-slate-500 w-20 text-right">{formatCr(t.purseCr)} left</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- live room
  if (!engine) return null;
  const lot = engine.lot;
  const user = engine.user();
  const leader = lot.leaderId ? engine.team(lot.leaderId) : null;
  const userLeading = lot.leaderId === engine.userTeamId;
  const nextAmount = lot.leaderId ? nextBidCr(lot.bidCr) : lot.bidCr;
  const canBid = engine.canUserBid();
  const countdownSec = Math.max(1, Math.ceil(lot.countdownMs / 1000));
  const progress = ((engine.lotIndex + (lot.phase === "sold" || lot.phase === "unsold" ? 1 : 0)) / engine.pool.length) * 100;

  let bidHint = "";
  if (user.slots <= 0) bidHint = "Squad full — enjoy the rest or skip to the verdict.";
  else if (lot.player.overseas && user.overseasSlots <= 0) bidHint = "No overseas slots left.";
  else if (engine.userPassed) bidHint = "You passed on this lot.";
  else if (userLeading) bidHint = "You're leading — hold for the hammer.";
  else if (!canBid) bidHint = `Purse reserve caps you at ${formatCr(engine.userMaxBidCr())}.`;

  const bidControls = (compact: boolean) => (
    <div className={`flex items-stretch gap-2 ${compact ? "" : "mt-4"}`}>
      <button
        onClick={() => {
          if (engine.userBid()) force();
        }}
        disabled={!canBid}
        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-wide transition ${
          compact ? "px-4 py-3 text-sm" : "px-6 py-4 text-base"
        } ${
          canBid
            ? "bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-[0_0_28px_-6px_rgba(245,158,11,0.8)] hover:from-amber-300 hover:to-amber-500 active:scale-[0.98]"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        <Gavel className={compact ? "h-4 w-4" : "h-5 w-5"} />
        {userLeading ? "Leading" : `Bid ${formatCr(nextAmount)}`}
      </button>
      <button
        onClick={() => {
          engine.userPass();
          sfx.ui();
          force();
        }}
        disabled={engine.userPassed || userLeading || lot.phase === "sold" || lot.phase === "unsold"}
        className={`rounded-xl border border-slate-700 bg-slate-800/80 font-bold text-slate-300 hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed ${compact ? "px-4 py-3 text-sm" : "px-5 py-4 text-sm"}`}
      >
        Pass
      </button>
    </div>
  );

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {/* Room top bar */}
      <div className="glass rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
        <button onClick={leaveRoom} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Leave
        </button>
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase" style={{ borderColor: team.color + "50", color: team.color, backgroundColor: team.color + "12" }}>
          {team.short}
        </span>
        <div className="flex-1 min-w-[120px]">
          <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>{lot.set} set</span>
            <span className="tabular-nums">Lot {engine.lotIndex + 1} / {engine.pool.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          onClick={() => {
            engine.speed = engine.speed === 1 ? 4 : 1;
            sfx.ui();
            force();
          }}
          aria-pressed={engine.speed === 4}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${engine.speed === 4 ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700"}`}
        >
          <FastForward className="h-3.5 w-3.5" /> {engine.speed}x
        </button>
        <button onClick={skipToEnd} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition">
          <Trophy className="h-3.5 w-3.5" /> Skip to verdict
        </button>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute auction sounds" : "Mute auction sounds"}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${muted ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile rival strip */}
      <div className="lg:hidden flex gap-2 overflow-x-auto custom-scrollbar pb-1">
        {engine.teams.filter((t) => !t.isUser).map((t) => (
          <div key={t.id} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] tabular-nums ${lot.leaderId === t.id ? "border-amber-400/60 bg-amber-400/10" : "border-slate-800 bg-slate-900/70"}`}>
            <span className="font-black uppercase" style={{ color: t.color }}>{t.short}</span>
            <span className="text-slate-400 ml-1.5">{formatCr(t.purseCr)}</span>
            <span className="text-slate-600 ml-1">{t.slots}sl</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_260px]">
        {/* Rival paddles */}
        <aside className="hidden lg:block glass rounded-2xl p-3 space-y-1.5 self-start">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 mb-2">Rival paddles</h2>
          {engine.teams.filter((t) => !t.isUser).map((t) => (
            <div
              key={t.id}
              className={`relative rounded-xl border px-3 py-2 overflow-hidden transition-colors ${lot.leaderId === t.id ? "border-amber-400/50 bg-amber-400/5" : "border-slate-800 bg-slate-900/50"}`}
            >
              {lot.leaderId === t.id && (lot.phase === "open" || lot.phase === "countdown") && (
                <span key={`${engine.lotIndex}-${lot.bidCr}`} className="absolute inset-0 paddle-flash pointer-events-none" style={{ backgroundColor: t.color + "22" }} />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase" style={{ color: t.color }}>{t.short}</span>
                {lot.leaderId === t.id && <span className="text-[8px] font-black uppercase text-amber-300">leading</span>}
              </div>
              <div className="flex justify-between text-[10px] tabular-nums text-slate-400 mt-0.5">
                <span className="font-bold text-slate-300">{formatCr(t.purseCr)}</span>
                <span>{t.slots} slots · {t.overseasSlots} OS</span>
              </div>
            </div>
          ))}
        </aside>

        {/* The lot */}
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={engine.lotIndex}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className={`glass rounded-2xl p-5 relative overflow-hidden ${lot.phase === "sold" && userLeading ? "auction-glow-user" : ""}`}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.07),transparent_55%)]" />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">{lot.set}</span>
                <span className="text-[10px] text-slate-500 tabular-nums">Base {formatCr(lot.player.basePriceCr)}</span>
              </div>

              <h1 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                {lot.player.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <RoleChip role={lot.player.role} />
                <PlayerBadges p={lot.player} />
                <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                  ex-{lot.player.formerTeam.toUpperCase()}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 py-1.5">
                  <div className="text-sm font-black text-white tabular-nums">{lot.player.iplMatches}</div>
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">IPL games</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 py-1.5">
                  <div className="text-sm font-black text-white tabular-nums">{lot.player.runs}</div>
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">runs</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 py-1.5">
                  <div className="text-sm font-black text-white tabular-nums">{lot.player.wickets}</div>
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">wickets</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 py-1.5">
                  <div className="text-sm font-black text-amber-300 tabular-nums">{lot.player.impact}</div>
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">impact</div>
                </div>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" style={{ width: `${lot.player.impact}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Editorial market value ~{formatCr(lot.player.valueCr)} — stingy paddles hoard cash, but headliners and bidding wars break the anchor.
              </p>

              {/* Bid state */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-center relative">
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                  {lot.leaderId ? "Current bid" : "Opening bid"}
                </div>
                <motion.div
                  key={`${engine.lotIndex}-${lot.bidCr}`}
                  initial={{ scale: 1.18 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="mt-1 text-4xl sm:text-5xl font-black tabular-nums bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent"
                >
                  {formatCr(lot.bidCr)}
                </motion.div>
                <div className="mt-2 min-h-[24px]">
                  {leader ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase ${userLeading ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : ""}`}
                      style={userLeading ? undefined : { borderColor: leader.color + "60", color: leader.color, backgroundColor: leader.color + "12" }}
                    >
                      {userLeading ? "★ You lead" : `${leader.short} leads`}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Waiting for the first paddle…</span>
                  )}
                </div>

                {lot.phase === "countdown" && (
                  <div className="mt-2">
                    <motion.div
                      key={countdownSec}
                      initial={{ scale: 1.5, opacity: 0.4 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black text-red-400 tabular-nums"
                    >
                      {countdownSec}
                    </motion.div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">
                      {countdownSec === 3 ? "Going once…" : countdownSec === 2 ? "Going twice…" : "Last chance!"}
                    </p>
                  </div>
                )}

                {/* Sold / unsold stamps */}
                {lot.phase === "sold" && leader && (
                  <motion.div
                    initial={{ scale: 2.2, opacity: 0, rotate: -14 }}
                    animate={{ scale: 1, opacity: 1, rotate: -8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border-4 backdrop-blur-[2px] ${userLeading ? "border-emerald-400 bg-emerald-950/70" : "border-slate-500 bg-slate-950/70"}`}
                  >
                    <span className={`text-3xl font-black uppercase tracking-widest ${userLeading ? "text-emerald-300" : "text-slate-200"}`}>
                      {userLeading ? "Sold to you!" : "Sold"}
                    </span>
                    <span className="text-sm font-bold text-amber-300 tabular-nums mt-1">
                      {formatCr(lot.bidCr)} · {leader.short}
                    </span>
                  </motion.div>
                )}
                {lot.phase === "unsold" && (
                  <motion.div
                    initial={{ scale: 2.2, opacity: 0, rotate: 10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="absolute inset-0 flex items-center justify-center rounded-xl border-4 border-slate-600 bg-slate-950/70 backdrop-blur-[2px]"
                  >
                    <span className="text-3xl font-black uppercase tracking-widest text-slate-500">Unsold</span>
                  </motion.div>
                )}

                {/* Gold burst when the user wins a lot */}
                {lot.phase === "sold" && userLeading && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
                    {Array.from({ length: 16 }).map((_, i) => {
                      const angle = (i / 16) * Math.PI * 2;
                      const dist = 70 + (i % 4) * 26;
                      return (
                        <span
                          key={`${engine.lotIndex}-${i}`}
                          className="auction-particle"
                          style={{
                            ["--dx" as string]: `${Math.cos(angle) * dist}px`,
                            ["--dy" as string]: `${Math.sin(angle) * dist}px`,
                            backgroundColor: ["#fbbf24", "#f59e0b", "#34d399", "#fde68a"][i % 4],
                            animationDelay: `${(i % 5) * 40}ms`,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {bidHint && <p className="mt-2 text-center text-[11px] text-slate-500">{bidHint}</p>}
              <div className="hidden lg:block">{bidControls(false)}</div>
            </motion.div>
          </AnimatePresence>

          {/* Mobile squad peek */}
          <details className="lg:hidden mt-3 glass rounded-2xl p-4">
            <summary className="text-xs font-black uppercase tracking-wider text-slate-400 cursor-pointer">
              Your room — {formatCr(user.purseCr)} · {user.slots} slots · {user.buys.length} buys
            </summary>
            <div className="mt-3 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
              {user.buys.length === 0 && <p className="text-xs text-slate-500">No buys yet. The paddle is warm.</p>}
              {user.buys.map((b) => (
                <div key={b.player.id} className="flex justify-between text-xs text-slate-300">
                  <span className="truncate">{b.player.name}</span>
                  <span className="font-bold tabular-nums text-amber-300 shrink-0 ml-2">{formatCr(b.priceCr)}</span>
                </div>
              ))}
            </div>
          </details>
        </main>

        {/* Your room */}
        <aside className="hidden lg:block glass rounded-2xl p-4 self-start">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Your room</h2>
          <div className="text-3xl font-black tabular-nums bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
            {formatCr(user.purseCr)}
          </div>
          <div className="mt-1 flex gap-3 text-[11px] text-slate-400 tabular-nums font-semibold">
            <span>{user.slots} slots</span>
            <span className="text-sky-300">{user.overseasSlots} overseas</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            Spent {formatCr(user.spentCr)} · kept {user.retained.length}
          </div>
          <div className="mt-3 border-t border-slate-800 pt-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
            {user.buys.length === 0 && (
              <p className="text-xs text-slate-500 py-2">No buys yet — pick your spots.</p>
            )}
            {user.buys.map((b) => (
              <motion.div
                key={b.player.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-2 rounded-lg bg-amber-400/5 border border-amber-400/20 px-2.5 py-1.5"
              >
                <span className="text-xs font-bold text-white truncate">{b.player.name}</span>
                <span className="text-xs font-black tabular-nums text-amber-300 shrink-0">{formatCr(b.priceCr)}</span>
              </motion.div>
            ))}
          </div>
        </aside>
      </div>

      {/* Mobile sticky paddle */}
      <div className="lg:hidden fixed bottom-[62px] inset-x-0 z-40 px-3 pb-2 pt-2 bg-gradient-to-t from-[#0a0f1a] via-[#0a0f1a]/95 to-transparent">
        {bidControls(true)}
      </div>
    </div>
  );
}