"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { commentary, inningsInsights, overSummaries } from "@/lib/insights";
import type { Innings } from "@/lib/scoring";

/** Colour ramp for the Manhattan bars, banded by runs conceded/scored. */
function barColor(runs: number): string {
  if (runs >= 15) return "bg-amber-400";
  if (runs >= 10) return "bg-sky-400";
  if (runs >= 6) return "bg-emerald-500";
  if (runs > 0) return "bg-slate-500";
  return "bg-slate-700";
}

/**
 * Manhattan chart — runs scored per over as bars, with a red marker on any
 * over that also produced a wicket.
 */
export function Manhattan({ innings }: { innings: Innings }) {
  const overs = overSummaries(innings);
  if (!overs.length) return null;

  const max = Math.max(6, ...overs.map((over) => over.runs));
  const showAll = overs.length <= 16;

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Runs per over
        </span>
        <span className="text-[10px] text-slate-500">
          peak {max} · {overs.length} ov
        </span>
      </div>

      <div className="flex items-end gap-0.5 h-24" role="img" aria-label="Runs scored per over">
        {overs.map((over) => {
          const height = Math.max(4, (over.runs / max) * 100);
          return (
            <div
              key={over.over}
              className="flex-1 min-w-[6px] flex flex-col items-center justify-end h-full"
              title={`Over ${over.over}: ${over.runs} runs${over.wickets ? `, ${over.wickets} wkt` : ""}`}
            >
              <span className="text-[8px] text-slate-500 mb-0.5 leading-none">
                {over.runs}
              </span>
              <div
                className={`w-full rounded-sm ${barColor(over.runs)}`}
                style={{ height: `${height}%` }}
              />
              {over.wickets > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-0.5" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-0.5 mt-1">
        {overs.map((over) => (
          <span
            key={over.over}
            className="flex-1 min-w-[6px] text-center text-[8px] text-slate-600 leading-none"
          >
            {showAll || over.over === overs.length || over.over % 5 === 0
              ? over.over
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chip({
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
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div className={`text-sm font-black font-mono truncate ${accent}`}>{value}</div>
      {hint && <div className="text-[9px] text-slate-500 truncate">{hint}</div>}
    </div>
  );
}

/** Innings talking points plus the Manhattan chart and the ball-by-ball feed. */
export function InningsAnalytics({ innings }: { innings: Innings }) {
  const [open, setOpen] = useState(false);
  const insight = inningsInsights(innings);
  const feed = commentary(innings);

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Chip
          label="Top score"
          value={insight.topScore ? insight.topScore.runs : "—"}
          hint={insight.topScore?.name}
          accent="text-emerald-300"
        />
        <Chip
          label="Best bowling"
          value={insight.bestBowl ? `${insight.bestBowl.wickets}/${insight.bestBowl.runs}` : "—"}
          hint={insight.bestBowl?.name}
          accent="text-rose-300"
        />
        <Chip label="Boundaries" value={insight.boundaries} accent="text-sky-300" />
        <Chip label="Dot balls" value={insight.dots} accent="text-slate-300" />
        <Chip
          label="Best over"
          value={insight.highestOver ? insight.highestOver.runs : "—"}
          hint={insight.highestOver ? `over ${insight.highestOver.over}` : undefined}
          accent="text-amber-300"
        />
        <Chip label="Run rate" value={insight.runRate.toFixed(2)} accent="text-violet-300" />
      </div>

      <Manhattan innings={innings} />

      <div>
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition-all"
        >
          <span>Ball-by-ball commentary</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="mt-2 space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {feed.map((over) => (
              <div key={over.over}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Over {over.over}
                </div>
                <ul className="space-y-1">
                  {over.lines.map((line, index) => (
                    <li
                      key={`${over.over}-${index}`}
                      className="flex items-start gap-2 text-[11px]"
                    >
                      <span className="font-mono text-slate-500 w-8 shrink-0">
                        {line.overText}
                      </span>
                      <span
                        className={`shrink-0 w-8 text-center font-mono font-bold rounded ${
                          line.wicket
                            ? "bg-rose-500/20 text-rose-200"
                            : line.boundary
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {line.label}
                      </span>
                      <span className="text-slate-400">{line.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
