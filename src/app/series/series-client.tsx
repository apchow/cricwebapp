"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ListOrdered, Plus, Trash2, X } from "lucide-react";

import Toast from "@/components/toast";
import ToolHeader from "@/components/tool-header";
import { useToast } from "@/lib/client";
import { matchDate } from "@/lib/dates";
import type { PublicMatch, PublicSeries } from "@/lib/dto";
import { formatNetRunRate, matchOutcome, standings } from "@/lib/series";

export default function SeriesClient() {
  const [series, setSeries] = useState<PublicSeries[] | null>(null);
  const [matches, setMatches] = useState<PublicMatch[] | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const { message: toast, notify } = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/series"), fetch("/api/matches")])
      .then(async ([seriesResponse, matchesResponse]) => {
        if (cancelled) return;
        if (seriesResponse.status === 401 || matchesResponse.status === 401) {
          setNeedsAccount(true);
          setSeries([]);
          setMatches([]);
          return;
        }
        const seriesData = (await seriesResponse.json()) as {
          series?: PublicSeries[];
        };
        const matchesData = (await matchesResponse.json()) as {
          matches?: PublicMatch[];
        };
        if (cancelled) return;
        const list = Array.isArray(seriesData.series) ? seriesData.series : [];
        setSeries(list);
        setMatches(Array.isArray(matchesData.matches) ? matchesData.matches : []);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setSeries([]);
        setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => (series ?? []).find((item) => item.id === selectedId) ?? null,
    [series, selectedId]
  );

  const inSeries = useMemo(() => {
    if (!selected) return [];
    const byId = new Map((matches ?? []).map((match) => [match.id, match]));
    return selected.matchIds
      .map((id) => byId.get(id))
      .filter((match): match is PublicMatch => Boolean(match))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [selected, matches]);

  const table = useMemo(() => standings(inSeries), [inSeries]);

  const available = useMemo(
    () =>
      (matches ?? []).filter(
        (match) => !selected?.matchIds.includes(match.id)
      ),
    [matches, selected]
  );

  async function createSeries() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const response = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    setBusy(false);
    if (!response || !response.ok) {
      notify("Could not create that series");
      return;
    }
    const data = (await response.json()) as { series: PublicSeries };
    setSeries((prev) => [data.series, ...(prev ?? [])]);
    setSelectedId(data.series.id);
    setNewName("");
    notify("Series created");
  }

  async function updateMatchIds(seriesId: string, nextIds: string[]) {
    const response = await fetch(`/api/series/${seriesId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchIds: nextIds }),
    }).catch(() => null);
    if (!response || !response.ok) {
      notify("Could not update the series");
      return;
    }
    const data = (await response.json()) as { series: PublicSeries };
    setSeries((prev) =>
      (prev ?? []).map((item) => (item.id === seriesId ? data.series : item))
    );
    notify("Series updated");
  }

  async function removeSeries(seriesId: string) {
    setSeries((prev) => (prev ?? []).filter((item) => item.id !== seriesId));
    if (selectedId === seriesId) setSelectedId(null);
    const response = await fetch(`/api/series/${seriesId}`, {
      method: "DELETE",
    }).catch(() => null);
    notify(response && response.ok ? "Series deleted" : "Could not delete that series");
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <Toast message={toast} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Tournaments"
          title="Series & Points Table"
          blurb="Group your scored matches into a series and watch the points table and net run rate sort themselves out."
          gradient="from-cyan-200 via-white to-blue-200"
        />

        {series === null && (
          <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            Loading your series…
          </div>
        )}

        {series !== null && needsAccount && (
          <div className="glass rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-black mb-2">Sign in to run a series</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Series pull together the matches you have scored, so you need to be
              signed in first.
            </p>
            <Link
              href="/login?next=/series"
              className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-[1.02] transition-all"
            >
              Sign in
            </Link>
          </div>
        )}

        {series !== null && !needsAccount && (
          <>
            <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap gap-2">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createSeries();
                }}
                placeholder="Name a new series, e.g. Sunday Sixes Cup"
                className="flex-1 min-w-[220px] bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              <button
                onClick={() => void createSeries()}
                disabled={!newName.trim() || busy}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
              >
                <Plus className="w-4 h-4" />
                Create series
              </button>
            </div>

            {(series ?? []).length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <div className="text-5xl mb-3">📋</div>
                <h2 className="text-2xl font-black mb-2">No series yet</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  Create one above, then add the matches you have already scored to
                  build a points table.
                </p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[260px_1fr] gap-6">
                <aside className="space-y-2">
                  {(series ?? []).map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                          active
                            ? "border-cyan-400/50 bg-cyan-500/10"
                            : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                        }`}
                      >
                        <div className="font-bold text-sm truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.matchIds.length} match
                          {item.matchIds.length === 1 ? "" : "es"}
                        </div>
                      </button>
                    );
                  })}
                </aside>

                {selected ? (
                  <section className="space-y-6">
                    <div className="glass rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            Series
                          </div>
                          <h2 className="text-xl font-black">{selected.name}</h2>
                        </div>
                        <button
                          onClick={() => void removeSeries(selected.id)}
                          aria-label={`Delete series ${selected.name}`}
                          className="w-9 h-9 grid place-items-center rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {table.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          No finished matches in this series yet — add a completed
                          match below and the table will appear.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[520px]">
                            <thead>
                              <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800/70">
                                <th className="text-left font-semibold py-2 pr-2">Team</th>
                                <th className="text-right font-semibold py-2 px-2">P</th>
                                <th className="text-right font-semibold py-2 px-2">W</th>
                                <th className="text-right font-semibold py-2 px-2">L</th>
                                <th className="text-right font-semibold py-2 px-2">T</th>
                                <th className="text-right font-semibold py-2 px-2">Pts</th>
                                <th className="text-right font-semibold py-2 pl-2">NRR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.map((row, index) => (
                                <tr
                                  key={row.team}
                                  className="border-b border-slate-800/40"
                                >
                                  <td className="py-2 pr-2 font-medium">
                                    <span
                                      className={`inline-block w-4 text-center mr-1 font-mono ${
                                        index === 0 ? "text-amber-300" : "text-slate-500"
                                      }`}
                                    >
                                      {index + 1}
                                    </span>
                                    {row.team}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                                    {row.played}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-emerald-300">
                                    {row.won}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-rose-300">
                                    {row.lost}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-400">
                                    {row.tied}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold">
                                    {row.points}
                                  </td>
                                  <td
                                    className={`py-2 pl-2 text-right font-mono ${
                                      row.netRunRate >= 0
                                        ? "text-emerald-300"
                                        : "text-rose-300"
                                    }`}
                                  >
                                    {formatNetRunRate(row.netRunRate)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="glass rounded-2xl p-5">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Fixtures
                      </h3>
                      {inSeries.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          Nothing here yet. Add a match from the list below.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {inSeries.map((match) => {
                            const outcome = matchOutcome(match.innings);
                            return (
                              <li
                                key={match.id}
                                className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                    {match.format} · {match.venue} · {matchDate(match.createdAt)}
                                  </div>
                                  <div className="text-xs font-mono text-slate-200 truncate">
                                    {match.scoreline}
                                  </div>
                                  <div
                                    className={`text-[11px] truncate ${
                                      outcome.winner ? "text-emerald-300/90" : "text-amber-300/90"
                                    }`}
                                  >
                                    {outcome.complete
                                      ? outcome.tied
                                        ? "Tied"
                                        : `${outcome.winner} won`
                                      : "In progress"}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    void updateMatchIds(
                                      selected.id,
                                      selected.matchIds.filter((id) => id !== match.id)
                                    )
                                  }
                                  aria-label={`Remove ${match.scoreline} from series`}
                                  className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="glass rounded-2xl p-5">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Add matches
                      </h3>
                      {available.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          {(matches ?? []).length === 0
                            ? "You have not scored any matches yet."
                            : "Every match you have scored is already in this series."}
                        </p>
                      ) : (
                        <ul className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                          {available.map((match) => (
                            <li
                              key={match.id}
                              className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                  {match.format} · {matchDate(match.createdAt)}
                                </div>
                                <div className="text-xs font-mono text-slate-200 truncate">
                                  {match.scoreline}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  void updateMatchIds(selected.id, [
                                    ...selected.matchIds,
                                    match.id,
                                  ])
                                }
                                aria-label={`Add ${match.scoreline} to series`}
                                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20 transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Add
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
                    <ListOrdered className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                    Pick a series from the list to see its table.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
