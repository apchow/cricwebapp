"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import TeamBadge from "@/components/team-badge";
import Toast from "@/components/toast";
import { crores } from "@/data/player-db";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import { flagOf } from "@/lib/flags";
import { battingAverage, bowlingAverage, economy, strikeRate } from "@/lib/stats";
import type { BattingStats, BowlingStats } from "@/lib/stats";
import type { Player, PlayerRole, PunditTag } from "@/types/player";

const FAVOURITES_KEY = "pavilion.favourites.v1";

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

export interface PlayerCareer {
  batting: BattingStats | null;
  bowling: BowlingStats | null;
}

function average(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

/** Four-axis spider chart over the scouting attributes. Pure SVG, no deps. */
function Radar({ player }: { player: Player }) {
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 28;
  const axes = [
    { label: "Form", value: player.form },
    { label: "Powerplay", value: player.ppImpact },
    { label: "Death", value: player.deathImpact },
    { label: "Value", value: player.vfm },
  ];

  const at = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    return [
      center + radius * ratio * Math.cos(angle),
      center + radius * ratio * Math.sin(angle),
    ] as const;
  };

  const shape = axes
    .map((axis, index) =>
      at(index, Math.min(100, Math.max(0, axis.value)) / 100).join(",")
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[240px] mx-auto"
      role="img"
      aria-label={`Attribute profile: ${axes
        .map((axis) => `${axis.label} ${axis.value}`)
        .join(", ")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, index) => at(index, ring).join(",")).join(" ")}
          fill="none"
          stroke="rgba(100,116,139,0.28)"
          strokeWidth={1}
        />
      ))}

      {axes.map((axis, index) => {
        const [x, y] = at(index, 1);
        const [lx, ly] = at(index, 1.2);
        return (
          <g key={axis.label}>
            <line
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(100,116,139,0.24)"
              strokeWidth={1}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400 text-[9px] font-bold uppercase tracking-wider"
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      <polygon
        points={shape}
        fill="url(#radar-fill)"
        stroke="#38bdf8"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {axes.map((axis, index) => {
        const [cx, cy] = at(index, Math.min(100, Math.max(0, axis.value)) / 100);
        return <circle key={axis.label} cx={cx} cy={cy} r={2.5} fill="#e0f2fe" />;
      })}

      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(56,189,248,0.45)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.45)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/40 border border-slate-800/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div className="font-mono font-black text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function EmptyFigures({ text }: { text: string }) {
  return (
    <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center">
      {text}
    </p>
  );
}

export default function PlayerProfile({
  player,
  career,
}: {
  player: Player;
  career: PlayerCareer;
}) {
  const [favourite, setFavourite] = useState(false);
  const { message: toast, notify } = useToast();

  useEffect(() => {
    const stored = readLocal(FAVOURITES_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        setFavourite(parsed.includes(player.id));
      }
    } catch {
      /* ignore malformed favourites */
    }
  }, [player.id]);

  function toggleFavourite() {
    const stored = readLocal(FAVOURITES_KEY);
    let current: number[] = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          current = parsed.filter((id): id is number => typeof id === "number");
        }
      } catch {
        /* start fresh */
      }
    }
    const next = current.includes(player.id)
      ? current.filter((id) => id !== player.id)
      : [...current, player.id];
    writeLocal(FAVOURITES_KEY, JSON.stringify(next));
    setFavourite(next.includes(player.id));
    notify(next.includes(player.id) ? "Added to favourites" : "Removed from favourites");
  }

  const batting = career.batting;
  const bowling = career.bowling;
  const hasCareer = Boolean(batting || bowling);

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-sky-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <Toast message={toast} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/players"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-5"
        >
          ← Stats Hub
        </Link>

        <header className="glass rounded-3xl p-5 sm:p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{flagOf(player.country)}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {player.country}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {player.name}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
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
                  <TeamBadge team={player.team} size={22} showName />
                )}
                {player.isUncapped && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-200 font-bold uppercase tracking-wider">
                    Uncapped
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                    TAG_STYLE[player.punditTag]
                  }`}
                >
                  {player.punditTag}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="font-mono font-black text-lg text-slate-100">
                {crores(player.basePrice)}
              </span>
              <button
                onClick={toggleFavourite}
                aria-pressed={favourite}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  favourite
                    ? "text-amber-200 bg-amber-500/15 border-amber-500/40"
                    : "text-slate-400 border-slate-800 hover:text-amber-200 hover:bg-amber-500/10"
                }`}
              >
                ★ {favourite ? "Favourited" : "Favourite"}
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="glass rounded-2xl p-5">
            <h2 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
              Attribute profile
            </h2>
            <Radar player={player} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Figure label="Form" value={String(player.form)} />
              <Figure label="Value" value={String(player.vfm)} />
              <Figure label="Powerplay" value={String(player.ppImpact)} />
              <Figure label="Death" value={String(player.deathImpact)} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <h2 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                Batting
              </h2>
              {batting ? (
                <div className="grid grid-cols-2 gap-2">
                  <Figure label="Innings" value={String(batting.innings)} />
                  <Figure label="Runs" value={String(batting.runs)} />
                  <Figure label="Average" value={average(battingAverage(batting))} />
                  <Figure label="Strike rate" value={strikeRate(batting).toFixed(1)} />
                  <Figure label="High score" value={String(batting.highScore)} />
                  <Figure label="Boundaries" value={`${batting.fours}×4 · ${batting.sixes}×6`} />
                  <Figure label="50s / 100s" value={`${batting.fifties} / ${batting.hundreds}`} />
                  <Figure label="Ducks" value={String(batting.ducks)} />
                </div>
              ) : (
                <EmptyFigures text="No scored innings yet — take them to the scorer to start their career record." />
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <h2 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                Bowling
              </h2>
              {bowling ? (
                <div className="grid grid-cols-2 gap-2">
                  <Figure label="Innings" value={String(bowling.innings)} />
                  <Figure label="Wickets" value={String(bowling.wickets)} />
                  <Figure label="Economy" value={economy(bowling).toFixed(2)} />
                  <Figure label="Average" value={average(bowlingAverage(bowling))} />
                  <Figure
                    label="Best"
                    value={`${bowling.bestWickets}/${bowling.bestRuns}`}
                  />
                  <Figure label="Runs conceded" value={String(bowling.runs)} />
                </div>
              ) : (
                <EmptyFigures text="No overs bowled yet — their bowling record appears once they send one down." />
              )}
            </div>
          </section>
        </div>

        {!hasCareer && (
          <p className="text-xs text-slate-500 mt-5 text-center">
            Career figures above are built from every match scored in this hub.
            Score one featuring {player.name} to fill them in.
          </p>
        )}
      </div>
    </div>
  );
}
