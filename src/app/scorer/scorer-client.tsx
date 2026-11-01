"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBall,
  formatForOvers,
  Innings,
  makeInnings,
  MatchState,
  oversString,
  resultText,
  RULE_PRESETS,
  VENUES,
  WicketType,
} from "@/lib/scoring";

const WICKET_TYPES: WicketType[] = [
  "Bowled",
  "Caught",
  "LBW",
  "Run Out",
  "Hit Wicket",
];

interface TeamSetup {
  name: string;
  players: string[];
  keeper: number | null;
}

interface Config {
  teamA: TeamSetup;
  teamB: TeamSetup;
  overs: number;
  venue: string;
  ruleIds: string[];
}

interface HistoryEntry {
  id: string;
  createdAt: string;
  format: string;
  venue: string;
  scoreline: string;
  result: string;
  innings: Innings[];
}

const DEFAULT_CONFIG: Config = {
  teamA: {
    name: "Gully Kings",
    players: ["Arjun", "Ravi", "Sameer", "Dev", "Kabir", "Zoya"],
    keeper: null,
  },
  teamB: {
    name: "Street Strikers",
    players: ["Neel", "Om", "Yash", "Vikram", "Adil", "Tara"],
    keeper: null,
  },
  overs: 6,
  venue: VENUES[0],
  ruleIds: ["one-tip", "wall-hit"],
};

function cloneMatch(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match)) as MatchState;
}

export default function ScorerClient() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [view, setView] = useState<"setup" | "live" | "done">("setup");
  const [undoStack, setUndoStack] = useState<MatchState[]>([]);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [stateResponse, matchesResponse] = await Promise.all([
          fetch("/api/match-state"),
          fetch("/api/matches"),
        ]);
        if (stateResponse.status === 401 || matchesResponse.status === 401) {
          window.location.assign("/login?next=/scorer");
          return;
        }
        const state = (await stateResponse.json()) as {
          state?: { config: Config; match: MatchState } | null;
        };
        const matches = (await matchesResponse.json()) as {
          matches?: HistoryEntry[];
        };
        if (cancelled) return;
        if (Array.isArray(matches.matches)) setHistory(matches.matches);
        const stored = state.state;
        if (stored?.match?.innings?.length) {
          setConfig(stored.config);
          setMatch(stored.match);
          const finished = Boolean(stored.match.innings[1]?.done);
          savedRef.current = finished;
          setView(finished ? "done" : "live");
        }
      } catch {
        if (!cancelled) {
          setOffline(true);
          notify("Could not reach the server");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  useEffect(() => {
    if (!match || loading || view === "done") return;
    const timer = setTimeout(() => {
      fetch("/api/match-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match, config }),
      })
        .then((response) => setOffline(!response.ok))
        .catch(() => setOffline(true));
    }, 600);
    return () => clearTimeout(timer);
  }, [match, config, loading, view]);

  useEffect(() => {
    if (match && match.current === 1 && match.innings[1]?.done && view === "live") {
      setView("done");
    }
  }, [match, view]);

  useEffect(() => {
    if (!match || view !== "done" || !match.innings[1]?.done) return;
    if (savedRef.current) return;
    savedRef.current = true;

    const first = match.innings[0];
    const second = match.innings[1];
    const entry = {
      format: formatForOvers(config.overs),
      venue: config.venue,
      scoreline: `${first.battingTeam} ${first.runs}/${first.wickets} (${oversString(
        first.legalBalls
      )}) · ${second.battingTeam} ${second.runs}/${second.wickets} (${oversString(
        second.legalBalls
      )})`,
      result: resultText(match),
      innings: [first, second],
    };

    (async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => null);

      if (!response?.ok) {
        savedRef.current = false;
        setOffline(true);
        return;
      }

      setOffline(false);
      const data = (await response.json()) as { match?: HistoryEntry };
      if (data.match) {
        const saved = data.match;
        setHistory((prev) => [saved, ...prev].slice(0, 50));
      }
      await fetch("/api/match-state", { method: "DELETE" }).catch(() => null);
    })();
  }, [match, view, config.overs, config.venue]);

  const innings = match ? match.innings[match.current] : null;

  const fieldingSetup = useMemo(() => {
    if (!match || !innings) return null;
    return innings.bowlingTeam === config.teamA.name ? config.teamA : config.teamB;
  }, [match, innings, config]);

  const hasKeeper = Boolean(
    fieldingSetup &&
      fieldingSetup.keeper !== null &&
      fieldingSetup.keeper < fieldingSetup.players.length
  );

  const pushUndo = useCallback((current: MatchState) => {
    setUndoStack((prev) => [...prev.slice(-49), cloneMatch(current)]);
  }, []);

  const handleApply = useCallback(
    (input: Parameters<typeof applyBall>[1]) => {
      if (!match || !innings) return;
      if (innings.done) return;
      if (!innings.bowler) {
        notify("Choose a bowler to start the over");
        return;
      }
      pushUndo(match);
      const updated = applyBall(
        innings,
        input,
        config.overs,
        match.target
      );
      const nextMatch: MatchState = {
        ...match,
        innings: match.innings.map((item, index) =>
          index === match.current ? updated : item
        ),
      };
      setMatch(nextMatch);
      setWicketOpen(false);
      if (updated.done && match.current === 0) {
        notify("Innings over");
      }
    },
    [match, innings, config.overs, pushUndo, notify]
  );

  const undo = useCallback(() => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setMatch(previous);
    setView("live");
    setWicketOpen(false);
    notify("Last ball undone");
  }, [undoStack, notify]);

  const pickBowler = useCallback(
    (name: string) => {
      if (!match || !innings || !name) return;
      setMatch({
        ...match,
        innings: match.innings.map((item, index) =>
          index === match.current ? { ...item, bowler: name } : item
        ),
      });
    },
    [match, innings]
  );

  const startMatch = useCallback(() => {
    const teamA = {
      ...config.teamA,
      name: config.teamA.name.trim() || "Team A",
      players: config.teamA.players.map((p) => p.trim()).filter(Boolean),
    };
    const teamB = {
      ...config.teamB,
      name: config.teamB.name.trim() || "Team B",
      players: config.teamB.players.map((p) => p.trim()).filter(Boolean),
    };
    if (!teamA.players.length || !teamB.players.length) {
      notify("Each team needs at least one player");
      return;
    }
    const nextConfig: Config = { ...config, teamA, teamB };
    const first = makeInnings(
      teamA.name,
      teamB.name,
      teamA.players,
      teamB.players
    );
    setConfig(nextConfig);
    setMatch({ innings: [first], current: 0, target: null });
    setUndoStack([]);
    setView("live");
    setShowCard(false);
    savedRef.current = false;
    notify("Match started — pick the opening bowler");
  }, [config, notify]);

  const startSecondInnings = useCallback(() => {
    if (!match) return;
    pushUndo(match);
    const first = match.innings[0];
    const second = makeInnings(
      config.teamB.name,
      config.teamA.name,
      config.teamB.players,
      config.teamA.players
    );
    setMatch({
      innings: [first, second],
      current: 1,
      target: first.runs + 1,
    });
    setView("live");
    setShowCard(false);
    notify(`Target: ${first.runs + 1}`);
  }, [match, config, pushUndo, notify]);

  const endInnings = useCallback(() => {
    if (!match || !innings || innings.done) return;
    if (!window.confirm("End this innings now?")) return;
    pushUndo(match);
    setMatch({
      ...match,
      innings: match.innings.map((item, index) =>
        index === match.current ? { ...item, done: true, bowler: null } : item
      ),
    });
  }, [match, innings, pushUndo]);

  const resetToSetup = useCallback(() => {    setMatch(null);
    setView("setup");
    setUndoStack([]);
    setShowCard(false);
    savedRef.current = false;
    fetch("/api/match-state", { method: "DELETE" }).catch(() => null);
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
    fetch(`/api/matches/${id}`, { method: "DELETE" }).catch(() => null);
  }, []);

  const abandonMatch = useCallback(() => {
    if (!window.confirm("Abandon this match? It will not be saved.")) return;
    resetToSetup();
    notify("Match abandoned");
  }, [resetToSetup, notify]);

  const shareResult = useCallback(() => {
    if (!match) return;
    const lines = match.innings.map(
      (inn) =>
        `${inn.battingTeam}: ${inn.runs}/${inn.wickets} (${oversString(
          inn.legalBalls
        )}/${config.overs})`
    );
    const text = `🏏 CricHub — Gully Scorer\n${lines.join(
      "\n"
    )}\n${resultText(match)}\nVenue: ${config.venue}`;
    navigator.clipboard
      .writeText(text)
      .then(() => notify("Scorecard copied"))
      .catch(() => notify("Could not copy"));
  }, [match, config, notify]);

  const overEvents = useMemo(() => {
    if (!innings) return [];
    const result: Innings["events"] = [];
    let legal = 0;
    for (let i = innings.events.length - 1; i >= 0; i--) {
      result.push(innings.events[i]);
      if (innings.events[i].legal) legal += 1;
      if (legal === 6) break;
    }
    return result.reverse();
  }, [innings]);

  const rules = useMemo(
    () => RULE_PRESETS.filter((rule) => config.ruleIds.includes(rule.id)),
    [config.ruleIds]
  );

  const formats = useMemo(() => {
    const unique = new Set(history.map((h) => h.format));
    return ["ALL", ...Array.from(unique)];
  }, [history]);

  useEffect(() => {
    if (formatFilter !== "ALL" && !formats.includes(formatFilter)) {
      setFormatFilter("ALL");
    }
  }, [formats, formatFilter]);

  const filteredHistory = useMemo(
    () =>
      formatFilter === "ALL"
        ? history
        : history.filter((h) => h.format === formatFilter),
    [history, formatFilter]
  );

  const legends = useMemo(() => {
    const map = new Map<string, { runs: number; innings: number; best: number }>();
    for (const entry of history) {
      for (const inn of entry.innings) {
        for (const batter of inn.batters) {
          const batted = batter.balls > 0 || batter.out !== null;
          if (!batted) continue;
          const record = map.get(batter.name) ?? { runs: 0, innings: 0, best: 0 };
          record.runs += batter.runs;
          record.innings += 1;
          record.best = Math.max(record.best, batter.runs);
          map.set(batter.name, record);
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 5);
  }, [history]);

  const striker = innings ? innings.batters[innings.striker] : null;
  const nonStriker =
    innings && innings.nonStriker >= 0
      ? innings.batters[innings.nonStriker]
      : null;
  const bowler =
    innings && innings.bowler
      ? innings.bowlers.find((b) => b.name === innings.bowler) ?? null
      : null;

  const crr = innings && innings.legalBalls > 0
    ? innings.runs / (innings.legalBalls / 6)
    : 0;
  const ballsLeft = config.overs * 6 - (innings?.legalBalls ?? 0);
  const runsNeeded = match?.target != null && innings ? match.target - innings.runs : null;
  const rrr =
    match?.target != null && innings && ballsLeft > 0
      ? ((match.target - innings.runs) / (ballsLeft / 6))
      : null;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 right-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] glass rounded-xl px-5 py-3 text-sm text-emerald-200 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-slide-up">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-2">
              Match Scorer
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
              Gully Scorer
            </h1>
            <p className="text-slate-400 mt-2 max-w-lg">
              Your street, your rules. Ball-by-ball scoring for any format from
              1 to 60 overs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to hub
            </Link>
          </div>
        </header>

        {loading && (
          <div className="glass rounded-2xl p-10 text-center text-slate-400">
            Loading your match data…
          </div>
        )}

        {offline && !loading && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Not saving to your account — the server could not be reached.
          </div>
        )}

        {!loading && view === "setup" && (
          <SetupScreen
            config={config}
            setConfig={setConfig}
            onStart={startMatch}
            history={filteredHistory}
            onDeleteMatch={deleteMatch}
            formats={formats}
            formatFilter={formatFilter}
            setFormatFilter={setFormatFilter}
            legends={legends}
          />
        )}

        {!loading && view === "live" && match && innings && (
          <>
            <section className="glass rounded-2xl p-5 sm:p-6 mb-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                      Innings {match.current + 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-bold uppercase tracking-wider">
                      {formatForOvers(config.overs)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {config.venue}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{innings.battingTeam}</div>
                </div>
                <div className="flex items-end gap-5">
                  <div className="text-right">
                    <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight">
                      {innings.runs}
                      <span className="text-slate-500">/</span>
                      {innings.wickets}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {oversString(innings.legalBalls)} / {config.overs} overs
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 space-y-1 pb-1">
                    <div>
                      CRR{" "}
                      <span className="text-slate-200 font-mono font-bold">
                        {crr.toFixed(2)}
                      </span>
                    </div>
                    {match.target !== null && runsNeeded !== null && (
                      <>
                        <div className="text-amber-300 font-semibold">
                          Need {Math.max(runsNeeded, 0)} from {Math.max(ballsLeft, 0)}
                        </div>
                        {rrr !== null && (
                          <div>
                            RRR{" "}
                            <span className="text-slate-200 font-mono font-bold">
                              {rrr.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="text-slate-500">
                          Target {match.target}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {innings.done && match.current === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-3">🥤</div>
                    <h2 className="text-2xl font-black mb-1">Innings break</h2>
                    <p className="text-slate-400 mb-1">
                      {innings.battingTeam} made{" "}
                      <span className="text-white font-bold">
                        {innings.runs}/{innings.wickets}
                      </span>{" "}
                      in {oversString(innings.legalBalls)} overs.
                    </p>
                    <p className="text-amber-300 text-sm mb-6">
                      {innings.bowlingTeam} need {(match.innings[0].runs + 1)} to win.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={startSecondInnings}
                        className="rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
                      >
                        Start the chase
                      </button>
                      <button
                        onClick={() => setShowCard((v) => !v)}
                        className="rounded-xl px-6 py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
                      >
                        {showCard ? "Hide scorecard" : "View scorecard"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-5 sm:p-6">
                    {!innings.bowler && !innings.done ? (
                      <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <div className="text-xs uppercase tracking-widest text-amber-300 font-bold mb-2">
                          {innings.legalBalls === 0
                            ? "Choose the opening bowler"
                            : "Over complete — choose the next bowler"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {innings.bowlers.map((b) => (
                            <button
                              key={b.name}
                              onClick={() => pickBowler(b.name)}
                              className="px-4 py-2 rounded-lg bg-slate-900/70 border border-slate-700/60 text-sm font-medium hover:border-amber-400/60 hover:text-amber-200 transition-colors"
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-3">
                      {[0, 1, 2, 3, 4, 6].map((run) => (
                        <button
                          key={run}
                          onClick={() => handleApply({ runs: run })}
                          disabled={!innings.bowler || innings.done}
                          className={`rounded-xl py-4 text-2xl font-black font-mono transition-all border ${
                            run === 6
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                              : run === 4
                              ? "bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25"
                              : "bg-slate-900/60 border-slate-700/60 text-slate-200 hover:bg-slate-800/80"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {run}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      <button
                        onClick={() => handleApply({ runs: 0, extra: "wd" })}
                        disabled={!innings.bowler || innings.done}
                        className="rounded-xl py-3 text-sm font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Wide +1
                      </button>
                      <button
                        onClick={() => handleApply({ runs: 0, extra: "nb" })}
                        disabled={!innings.bowler || innings.done}
                        className="rounded-xl py-3 text-sm font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        No ball +1
                      </button>
                      <button
                        onClick={() => setWicketOpen(true)}
                        disabled={!innings.bowler || innings.done}
                        className="rounded-xl py-3 text-sm font-black uppercase tracking-wider bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Wicket
                      </button>
                    </div>

                    {rules.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-2">
                          Gully rules
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rules.map((rule) => (
                            <button
                              key={rule.id}
                              title={rule.description}
                              onClick={() => {
                                if (rule.effect.kind === "runs") {
                                  handleApply({
                                    runs: rule.effect.runs,
                                    ruleLabel: rule.label,
                                  });
                                } else {
                                  handleApply({
                                    runs: 0,
                                    wicket: "Gully Rule",
                                    ruleLabel: rule.label,
                                    penalty: rule.effect.penalty,
                                  });
                                }
                              }}
                              disabled={!innings.bowler || innings.done}
                              className="px-3 py-2 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-200 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {rule.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                      <button
                        onClick={undo}
                        disabled={!undoStack.length}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        ↩ Undo
                      </button>
                      <button
                        onClick={() => setShowCard((v) => !v)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-all"
                      >
                        {showCard ? "Hide scorecard" : "Scorecard"}
                      </button>
                      <button
                        onClick={endInnings}
                        disabled={innings.done}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-40 transition-all"
                      >
                        End innings
                      </button>
                      <button
                        onClick={abandonMatch}
                        className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
                      >
                        Abandon
                      </button>
                    </div>
                  </div>
                )}

                {showCard && (
                  <Scorecard innings={innings} overs={config.overs} />
                )}
              </div>

              <div className="space-y-5">
                <div className="glass rounded-2xl p-5">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                    At the crease
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-8 rounded-full bg-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {striker?.name ?? "—"}{" "}
                          {striker && !striker.out && (
                            <span className="text-emerald-400 text-xs">*</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          striker
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-lg font-bold">
                          {striker?.runs ?? 0}
                        </span>
                        <span className="text-slate-500 text-xs">
                          ({striker?.balls ?? 0})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 opacity-80">
                      <span className="w-1.5 h-8 rounded-full bg-slate-600" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {nonStriker?.name ?? "—"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          non-striker
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-lg font-bold">
                          {nonStriker?.runs ?? 0}
                        </span>
                        <span className="text-slate-500 text-xs">
                          ({nonStriker?.balls ?? 0})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-slate-500">bowler</div>
                        <div className="font-semibold">
                          {bowler?.name ?? "Not selected"}
                        </div>
                      </div>
                      <div className="text-right font-mono text-sm">
                        {bowler ? (
                          <>
                            <span className="text-slate-200">
                              {oversString(bowler.balls)}-{bowler.runs}-
                              {bowler.wickets}
                            </span>
                            <div className="text-[11px] text-slate-500">
                              Econ{" "}
                              {bowler.balls
                                ? (bowler.runs / (bowler.balls / 6)).toFixed(2)
                                : "0.00"}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                      This over
                    </h2>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {innings.extras.wd + innings.extras.nb} extras
                    </span>
                  </div>
                  {overEvents.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No deliveries yet this over.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {overEvents.map((event) => (
                        <span
                          key={event.id}
                          className={`min-w-8 h-8 px-2 rounded-full flex items-center justify-center text-xs font-bold border ${
                            event.wicket
                              ? "bg-red-500/20 border-red-500/40 text-red-300"
                              : event.runs >= 6
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : event.runs >= 4
                              ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                              : event.runs === 0
                              ? "bg-slate-800/60 border-slate-700/50 text-slate-400"
                              : "bg-slate-800/60 border-slate-700/50 text-slate-200"
                          }`}
                        >
                          {event.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass rounded-2xl p-5 text-xs text-slate-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Venue</span>
                    <span className="text-slate-200">{config.venue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Format</span>
                    <span className="text-slate-200">
                      {formatForOvers(config.overs)} · {config.overs} overs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wicket-keeper</span>
                    <span className="text-slate-200">
                      {hasKeeper
                        ? fieldingSetup?.players[fieldingSetup.keeper!]
                        : "None (no stumping)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery history</span>
                    <span className="text-slate-200 font-mono">
                      {innings.events.length} balls
                    </span>
                  </div>
                </div>

                <button
                  onClick={shareResult}
                  className="w-full rounded-xl py-3 text-sm font-bold bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition-all"
                >
                  Copy scorecard
                </button>
              </div>
            </div>

            {wicketOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="glass rounded-2xl p-6 w-full max-w-md animate-bounce-in">
                  <h3 className="text-lg font-black mb-1">How was he out?</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {hasKeeper
                      ? "Stumping is available — keeper is set."
                      : "No keeper in the fielding side, so stumping is disabled."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(hasKeeper
                      ? [...WICKET_TYPES, "Stumped" as WicketType]
                      : WICKET_TYPES
                    ).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleApply({ runs: 0, wicket: type })}
                        className="rounded-lg py-3 text-sm font-semibold bg-slate-800/70 border border-slate-700/60 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setWicketOpen(false)}
                    className="w-full mt-3 rounded-lg py-2.5 text-sm text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && view === "done" && match && (
          <ResultScreen
            match={match}
            overs={config.overs}
            venue={config.venue}
            onShare={shareResult}
            onNew={resetToSetup}
          />
        )}
      </div>
    </div>
  );
}

function SetupScreen({
  config,
  setConfig,
  onStart,
  history,
  onDeleteMatch,
  formats,
  formatFilter,
  setFormatFilter,
  legends,
}: {
  config: Config;
  setConfig: (config: Config) => void;
  onStart: () => void;
  history: HistoryEntry[];
  onDeleteMatch: (id: string) => void;
  formats: string[];
  formatFilter: string;
  setFormatFilter: (value: string) => void;
  legends: { name: string; runs: number; innings: number; best: number }[];
}) {
  const format = formatForOvers(config.overs);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TeamEditor
          team={config.teamA}
          label="Team A · bats first"
          accent="text-sky-300"
          onChange={(teamA) => setConfig({ ...config, teamA })}
        />
        <TeamEditor
          team={config.teamB}
          label="Team B · bowls first"
          accent="text-emerald-300"
          onChange={(teamB) => setConfig({ ...config, teamB })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Match settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">
                Overs (1–60)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={config.overs}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setConfig({
                    ...config,
                    overs: Math.min(60, Math.max(1, Number.isFinite(value) ? value : 1)),
                  });
                }}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="text-[11px] text-emerald-300 mt-1.5 font-semibold">
                {format}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">
                Venue
              </label>
              <select
                value={config.venue}
                onChange={(e) => setConfig({ ...config, venue: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
              >
                {VENUES.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-slate-500 mb-1.5 block">
              Quick overs
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 5, 6, 10, 20, 50].map((overs) => (
                <button
                  key={overs}
                  onClick={() => setConfig({ ...config, overs })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    config.overs === overs
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white"
                  }`}
                >
                  {overs} ov
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs text-slate-500 mb-2 block">
              Gully rules
            </label>
            <div className="space-y-2">
              {RULE_PRESETS.map((rule) => {
                const active = config.ruleIds.includes(rule.id);
                return (
                  <button
                    key={rule.id}
                    onClick={() =>
                      setConfig({
                        ...config,
                        ruleIds: active
                          ? config.ruleIds.filter((id) => id !== rule.id)
                          : [...config.ruleIds, rule.id],
                      })
                    }
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      active
                        ? "bg-purple-500/10 border-purple-500/40"
                        : "bg-slate-900/50 border-slate-800/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {rule.label}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {rule.description}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${
                          active
                            ? "bg-purple-500/30 border-purple-400/60 text-purple-200"
                            : "border-slate-700 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
              Gully legends
            </h3>
            {legends.length === 0 ? (
              <p className="text-xs text-slate-500">
                Finish a match to start your leaderboard.
              </p>
            ) : (
              <div className="space-y-2">
                {legends.map((legend, index) => (
                  <div
                    key={legend.name}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-5 text-xs font-mono text-slate-500">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium truncate">
                      {legend.name}
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {legend.runs}
                    </span>
                    <span className="text-[10px] text-slate-500 w-12 text-right">
                      {legend.innings} inn
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
              Recent matches
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                {formats.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "All formats" : item}
                  </option>
                ))}
              </select>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">
                No matches saved yet. Score one to build your history.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        {entry.format} · {entry.venue}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" }
                          )}
                        </span>
                        <button
                          onClick={() => onDeleteMatch(entry.id)}
                          className="w-5 h-5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 text-xs transition-all"
                          aria-label={`Delete match against ${entry.scoreline}`}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-300 leading-relaxed">
                      {entry.scoreline}
                    </div>
                    <div className="text-[11px] text-emerald-300/90 mt-1">
                      {entry.result}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={onStart}
          className="w-full sm:w-80 rounded-xl py-4 font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25"
        >
          Start match
        </button>
      </div>
    </div>
  );
}

function TeamEditor({
  team,
  label,
  accent,
  onChange,
}: {
  team: TeamSetup;
  label: string;
  accent: string;
  onChange: (team: TeamSetup) => void;
}) {
  function updatePlayer(index: number, value: string) {
    const players = team.players.map((p, i) => (i === index ? value : p));
    onChange({ ...team, players });
  }

  function addPlayer() {
    if (team.players.length >= 11) return;
    onChange({
      ...team,
      players: [...team.players, `Player ${team.players.length + 1}`],
    });
  }

  function removePlayer(index: number) {
    if (team.players.length <= 1) return;
    const players = team.players.filter((_, i) => i !== index);
    let keeper = team.keeper;
    if (keeper !== null) {
      if (keeper === index) keeper = null;
      else if (keeper > index) keeper -= 1;
    }
    onChange({ ...team, players, keeper });
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-xs font-bold uppercase tracking-widest ${accent}`}>
          {label}
        </h3>
        <span className="text-[10px] text-slate-500">
          {team.players.length}/11 players
        </span>
      </div>
      <input
        value={team.name}
        onChange={(e) => onChange({ ...team, name: e.target.value })}
        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-base font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
        {team.players.map((player, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 text-[10px] font-mono text-slate-500 text-center">
              {index + 1}
            </span>
            <input
              value={player}
              onChange={(e) => updatePlayer(index, e.target.value)}
              placeholder={`Player ${index + 1}`}
              className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
            />
            <button
              onClick={() => removePlayer(index)}
              disabled={team.players.length <= 1}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label={`Remove ${player}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mt-3">
        <button
          onClick={addPlayer}
          disabled={team.players.length >= 11}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-40 transition-all"
        >
          + Add player
        </button>
        <select
          value={team.keeper === null ? "" : String(team.keeper)}
          onChange={(e) =>
            onChange({
              ...team,
              keeper: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
        >
          <option value="">No wicket-keeper</option>
          {team.players.map((player, index) => (
            <option key={index} value={index}>
              WK: {player}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Scorecard({ innings, overs }: { innings: Innings; overs: number }) {
  const totalExtras = innings.extras.wd + innings.extras.nb + innings.extras.penalty;
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
            Scorecard
          </div>
          <h3 className="text-lg font-bold">{innings.battingTeam}</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black font-mono">
            {innings.runs}/{innings.wickets}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {oversString(innings.legalBalls)}/{overs} ov
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="text-left font-semibold py-2 pr-2">Batter</th>
              <th className="text-left font-semibold py-2 px-2">How out</th>
              <th className="text-right font-semibold py-2 px-2">R</th>
              <th className="text-right font-semibold py-2 px-2">B</th>
              <th className="text-right font-semibold py-2 px-2">4s</th>
              <th className="text-right font-semibold py-2 px-2">6s</th>
              <th className="text-right font-semibold py-2 pl-2">SR</th>
            </tr>
          </thead>
          <tbody>
            {innings.batters.map((batter, index) => {
              const atCrease =
                index === innings.striker || index === innings.nonStriker;
              const batted = batter.balls > 0 || batter.out !== null || atCrease;
              return (
                <tr
                  key={index}
                  className={`border-b border-slate-800/50 ${
                    atCrease && !innings.done ? "bg-emerald-500/5" : ""
                  }`}
                >
                  <td className="py-2 pr-2 font-medium whitespace-nowrap">
                    {batter.name}
                    {atCrease && !batter.out && !innings.done && (
                      <span className="text-emerald-400">*</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-400">
                    {batter.out
                      ? batter.out
                      : batted
                      ? "not out"
                      : "did not bat"}
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
                  <td className="py-2 pl-2 text-right font-mono text-slate-400">
                    {batter.balls
                      ? ((batter.runs / batter.balls) * 100).toFixed(0)
                      : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-5 pb-4 border-b border-slate-800">
        <span>
          Extras{" "}
          <span className="font-mono text-slate-200">{totalExtras}</span>{" "}
          <span className="text-slate-500">
            (wd {innings.extras.wd}, nb {innings.extras.nb}
            {innings.extras.penalty ? `, pen ${innings.extras.penalty}` : ""})
          </span>
        </span>
        <span>
          Total{" "}
          <span className="font-mono font-bold text-slate-100">
            {innings.runs}/{innings.wickets}
          </span>{" "}
          <span className="text-slate-500">
            ({oversString(innings.legalBalls)} overs)
          </span>
        </span>
      </div>

      <div className="text-[11px] text-slate-500 mb-5">
        <span className="uppercase tracking-wider font-bold">Fall of wickets: </span>
        {innings.fow.length ? innings.fow.join(" · ") : "—"}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="text-left font-semibold py-2 pr-2">Bowler</th>
              <th className="text-right font-semibold py-2 px-2">O</th>
              <th className="text-right font-semibold py-2 px-2">R</th>
              <th className="text-right font-semibold py-2 px-2">W</th>
              <th className="text-right font-semibold py-2 pl-2">Econ</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowlers
              .filter(
                (bowler) =>
                  bowler.balls > 0 || bowler.name === innings.bowler
              )
              .map((bowler, index) => (
              <tr key={index} className="border-b border-slate-800/50">
                <td className="py-2 pr-2 font-medium whitespace-nowrap">
                  {bowler.name}
                  {bowler.name === innings.bowler && !innings.done && (
                    <span className="text-emerald-400 text-xs"> •</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {oversString(bowler.balls)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-slate-300">
                  {bowler.runs}
                </td>
                <td className="py-2 px-2 text-right font-mono font-bold">
                  {bowler.wickets}
                </td>
                <td className="py-2 pl-2 text-right font-mono text-slate-400">
                  {bowler.balls
                    ? (bowler.runs / (bowler.balls / 6)).toFixed(2)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultScreen({
  match,
  overs,
  venue,
  onShare,
  onNew,
}: {
  match: MatchState;
  overs: number;
  venue: string;
  onShare: () => void;
  onNew: () => void;
}) {
  const [first, second] = match.innings;
  const result = resultText(match);
  const chaseWon = second.runs >= (match.target ?? Infinity);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
        <div className="relative">
          <div className="text-5xl mb-3">{chaseWon ? "🏆" : "🏏"}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">
            Result · {overs} overs · {venue}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{result}</h2>
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
            {[first, second].map((inn, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
              >
                <div className="text-[11px] text-slate-500 truncate">
                  {inn.battingTeam}
                </div>
                <div className="text-2xl font-black font-mono">
                  {inn.runs}/{inn.wickets}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {oversString(inn.legalBalls)} overs
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              onClick={onShare}
              className="rounded-xl px-5 py-2.5 text-sm font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
            >
              Copy scorecard
            </button>
            <button
              onClick={onNew}
              className="rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
            >
              New match
            </button>
          </div>
        </div>
      </div>

      <Scorecard innings={first} overs={overs} />
      <Scorecard innings={second} overs={overs} />
    </div>
  );
}
