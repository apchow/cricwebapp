"use client";

import { InningsAnalytics } from "@/components/match-analytics";
import { oversString, type Innings } from "@/lib/scoring";

const SERIES_COLORS = ["#34d399", "#38bdf8"];

/** Batter faced a ball, was dismissed, or is still at the crease. */
function didBat(innings: Innings, index: number): boolean {
  const batter = innings.batters[index];
  if (!batter) return false;
  return (
    batter.balls > 0 ||
    batter.out !== null ||
    innings.striker === index ||
    innings.nonStriker === index
  );
}

interface WormPoint {
  over: number;
  runs: number;
}

/** Cumulative runs after each legal delivery — the classic run-rate worm. */
function runWorm(innings: Innings): WormPoint[] {
  const points: WormPoint[] = [{ over: 0, runs: 0 }];
  let runs = 0;
  let balls = 0;
  for (const event of innings.events) {
    runs += event.runs;
    if (!event.legal) continue;
    balls += 1;
    points.push({ over: balls / 6, runs });
  }
  return points;
}

function wickets(innings: Innings): WormPoint[] {
  const marks: WormPoint[] = [];
  let runs = 0;
  let balls = 0;
  for (const event of innings.events) {
    runs += event.runs;
    if (event.legal) balls += 1;
    if (event.wicket) marks.push({ over: balls / 6, runs });
  }
  return marks;
}

export function RunWorm({ innings }: { innings: Innings[] }) {
  const series = innings.map((item) => ({
    innings: item,
    points: runWorm(item),
    marks: wickets(item),
  }));

  const maxOver = Math.max(
    1,
    ...series.map((item) => item.points[item.points.length - 1]?.over ?? 0)
  );
  const maxRuns = Math.max(
    12,
    ...series.map((item) => item.points[item.points.length - 1]?.runs ?? 0)
  );

  const W = 320;
  const H = 108;
  const PAD = 6;
  const x = (over: number) => PAD + (over / maxOver) * (W - PAD * 2);
  const y = (runs: number) => H - PAD - (runs / maxRuns) * (H - PAD * 2);

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Run worm
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {series.map((item, index) => (
            <span
              key={item.innings.battingTeam}
              className="flex items-center gap-1.5 text-[10px] text-slate-400"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
              />
              {item.innings.battingTeam}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-28"
        role="img"
        aria-label="Runs scored per over for each innings"
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - fraction * (H - PAD * 2)}
            y2={H - PAD - fraction * (H - PAD * 2)}
            stroke="rgba(148,163,184,0.14)"
            strokeWidth={1}
          />
        ))}
        {series.map((item, index) => {
          const color = SERIES_COLORS[index % SERIES_COLORS.length];
          const path = item.points
            .map(
              (point, pointIndex) =>
                `${pointIndex === 0 ? "M" : "L"}${x(point.over).toFixed(1)},${y(
                  point.runs
                ).toFixed(1)}`
            )
            .join(" ");
          return (
            <g key={item.innings.battingTeam}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {item.marks.map((mark, markIndex) => (
                <circle
                  key={markIndex}
                  cx={x(mark.over)}
                  cy={y(mark.runs)}
                  r={2.6}
                  fill="#0f172a"
                  stroke="#f87171"
                  strokeWidth={1.6}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Scorecard({ innings }: { innings: Innings }) {
  const batting = innings.batters
    .map((batter, index) => ({ batter, index }))
    .filter(({ index }) => didBat(innings, index));
  const yetToBat = innings.batters.filter((_, index) => !didBat(innings, index));
  const bowling = innings.bowlers.filter(
    (bowler) => bowler.balls > 0 || bowler.wickets > 0
  );
  const extras = innings.extras;
  const extrasTotal =
    extras.wd + extras.nb + extras.b + extras.lb + extras.penalty;

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-slate-800/70 bg-slate-900/50">
        <span className="font-bold text-sm">{innings.battingTeam}</span>
        <span className="font-mono font-black text-lg">
          {innings.runs}/{innings.wickets}
          <span className="text-xs font-normal text-slate-500 ml-2">
            ({oversString(innings.legalBalls)} ov)
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800/70">
              <th className="text-left font-semibold py-2 pl-4 pr-2">Batter</th>
              <th className="text-right font-semibold py-2 px-2">R</th>
              <th className="text-right font-semibold py-2 px-2">B</th>
              <th className="text-right font-semibold py-2 px-2">4s</th>
              <th className="text-right font-semibold py-2 px-2">6s</th>
              <th className="text-right font-semibold py-2 pl-2 pr-4">SR</th>
            </tr>
          </thead>
          <tbody>
            {batting.map(({ batter, index }) => {
              const rate =
                batter.balls > 0
                  ? ((batter.runs / batter.balls) * 100).toFixed(0)
                  : "—";
              return (
                <tr
                  key={`${batter.name}-${index}`}
                  className="border-b border-slate-800/40"
                >
                  <td className="py-2 pl-4 pr-2">
                    <span className="font-medium">{batter.name}</span>
                    <span
                      className={`ml-2 text-[10px] ${
                        batter.out ? "text-red-300/90" : "text-emerald-300/90"
                      }`}
                    >
                      {batter.out ?? "not out"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {batter.runs}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                    {batter.balls}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                    {batter.fours}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                    {batter.sixes}
                  </td>
                  <td className="py-2 pl-2 pr-4 text-right font-mono text-slate-300">
                    {rate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-800/60 space-y-1">
        <div>
          <span className="text-slate-500">Extras </span>
          <span className="font-mono text-slate-300">{extrasTotal}</span>
          <span className="text-slate-500">
            {" "}
            (b {extras.b}, lb {extras.lb}, w {extras.wd}, nb {extras.nb}
            {extras.penalty ? `, p ${extras.penalty}` : ""})
          </span>
        </div>
        {yetToBat.length > 0 && (
          <div>
            <span className="text-slate-500">Did not bat </span>
            <span className="text-slate-400">
              {yetToBat.map((batter) => batter.name).join(", ")}
            </span>
          </div>
        )}
        {innings.fow.length > 0 && (
          <div>
            <span className="text-slate-500">Fall of wickets </span>
            <span className="font-mono text-slate-400">
              {innings.fow.join(" · ")}
            </span>
          </div>
        )}
      </div>

      {bowling.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-800/70">
          <table className="w-full text-xs min-w-[420px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800/70">
                <th className="text-left font-semibold py-2 pl-4 pr-2">Bowler</th>
                <th className="text-right font-semibold py-2 px-2">O</th>
                <th className="text-right font-semibold py-2 px-2">R</th>
                <th className="text-right font-semibold py-2 px-2">W</th>
                <th className="text-right font-semibold py-2 pl-2 pr-4">Econ</th>
              </tr>
            </thead>
            <tbody>
              {bowling.map((bowler) => (
                <tr key={bowler.name} className="border-b border-slate-800/40">
                  <td className="py-2 pl-4 pr-2 font-medium">{bowler.name}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                    {Math.floor(bowler.balls / 6)}.{bowler.balls % 6}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                    {bowler.runs}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {bowler.wickets}
                  </td>
                  <td className="py-2 pl-2 pr-4 text-right font-mono text-slate-300">
                    {bowler.balls > 0
                      ? (bowler.runs / (bowler.balls / 6)).toFixed(2)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Full read-only match view: run worm plus every innings scorecard. */
export function MatchScorecard({ innings }: { innings: Innings[] }) {
  return (
    <div className="space-y-3">
      <RunWorm innings={innings} />
      {innings.map((item, index) => (
        <div key={index} className="space-y-3">
          <Scorecard innings={item} />
          <InningsAnalytics innings={item} />
        </div>
      ))}
    </div>
  );
}
