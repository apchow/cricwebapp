import {
  battingAverage,
  bowlingAverage,
  economy,
  strikeRate,
  type BattingStats,
  type BowlingStats,
} from "@/lib/stats";

/**
 * Career tables shared by the stats hub and the match centre. Both screens
 * aggregate the same `battingStats` / `bowlingStats` rows, so the markup lives
 * here instead of being copied per page.
 */

export function BattingTable({
  rows,
  limit,
}: {
  rows: BattingStats[];
  /** Show only the first N rows, e.g. a top-10 leaderboard. */
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;

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
          {visible.map((row) => {
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

export function BowlingTable({
  rows,
  limit,
}: {
  rows: BowlingStats[];
  /** Show only the first N rows, e.g. a top-10 leaderboard. */
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;

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
          {visible.map((row) => {
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
