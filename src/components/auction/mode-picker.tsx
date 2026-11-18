"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, SlidersHorizontal, ArrowRight, ArrowLeftRight } from "lucide-react";

export interface HubTeam {
  id: string;
  name: string;
  short: string;
  color: string;
  purseCr: number;
  slots: number;
  overseasSlots: number;
  retainedCount: number;
  topRetained: string[];
  hasTrades: boolean;
  retired: string[];
}

export default function ModePicker({ teams }: { teams: HubTeam[] }) {
  const [mode, setMode] = useState<"official" | "custom">("official");

  const options = [
    {
      id: "official" as const,
      icon: BadgeCheck,
      tag: "As announced",
      title: "Official retentions",
      blurb:
        "The real lists locked on 17 November. Every purse, slot and overseas quota exactly as the franchises announced them.",
      accent: "amber",
    },
    {
      id: "custom" as const,
      icon: SlidersHorizontal,
      tag: "Your rules",
      title: "Choose your retentions",
      blurb:
        "Keep who you want and name your price. Your purse, slots and overseas budget are computed live as you pick.",
      accent: "emerald",
    },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 mb-8" aria-label="Choose how to enter the auction">
        {options.map((o) => {
          const active = mode === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              aria-pressed={active}
              className={`group relative text-left rounded-2xl border p-5 transition-all overflow-hidden ${
                active
                  ? o.accent === "amber"
                    ? "border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-950 shadow-[0_0_40px_-12px_rgba(245,158,11,0.45)]"
                    : "border-emerald-400/70 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-slate-950 shadow-[0_0_40px_-12px_rgba(34,197,94,0.45)]"
                  : "border-slate-700/60 bg-slate-900/60 hover:border-slate-500"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
                    o.accent === "amber"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                      : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 border ${
                    active
                      ? o.accent === "amber"
                        ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                        : "border-emerald-400/50 text-emerald-300 bg-emerald-400/10"
                      : "border-slate-700 text-slate-500"
                  }`}
                >
                  {active ? "Selected" : o.tag}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">{o.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400 leading-snug">{o.blurb}</p>
              <span
                className={`mt-4 inline-flex items-center gap-1.5 text-xs font-bold ${
                  o.accent === "amber" ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                {active ? "Now pick your franchise below" : "Tap to select"}
                <ArrowRight className={`h-3.5 w-3.5 transition-transform ${active ? "translate-y-0.5 rotate-90" : "group-hover:translate-x-0.5"}`} />
              </span>
            </button>
          );
        })}
      </section>

      <section id="teams" className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">
              Pick your franchise
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === "official"
                ? "Sorted by remaining purse — the richest pockets bid hardest."
                : "You'll rebuild this team's retention list your way before the paddle goes up."}
            </p>
          </div>
          <Link
            href="/auction/rules"
            className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
          >
            Mini-auction rules <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {teams.map((t, i) => (
            <Link
              key={t.id}
              href={`/auction/${t.id}?mode=${mode}`}
              className="group relative rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 hover:bg-slate-900 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: `inset 0 2px 0 0 ${t.color}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase"
                  style={{ borderColor: t.color + "50", color: t.color, backgroundColor: t.color + "12" }}
                >
                  {t.short}
                </span>
                <span className="text-[10px] text-slate-500 font-bold tabular-nums">#{i + 1} purse</span>
              </div>
              <h3 className="text-sm font-bold text-white truncate">{t.name}</h3>
              <div className="mt-2 text-2xl font-black tabular-nums bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                ₹{t.purseCr.toFixed(2)}
                <span className="text-xs font-bold text-slate-500 ml-1">cr left</span>
              </div>
              <div className="mt-2 flex gap-3 text-[11px] text-slate-400 tabular-nums font-semibold">
                <span>{t.slots} slots</span>
                <span>{t.overseasSlots} overseas</span>
                <span>{t.retainedCount} kept</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 line-clamp-1">
                {t.topRetained.join(" · ")}
              </p>
              <div className="mt-2 flex items-center gap-2 min-h-[16px]">
                {t.hasTrades && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-sky-400">
                    <ArrowLeftRight className="h-3 w-3" /> trades
                  </span>
                )}
                {t.retired.length > 0 && (
                  <span className="text-[9px] font-bold uppercase text-slate-500">
                    {t.retired.join(", ")} retired
                  </span>
                )}
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-amber-300 transition-colors">
                Enter the room <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}