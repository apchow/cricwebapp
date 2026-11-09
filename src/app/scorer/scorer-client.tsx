"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Toast from "@/components/toast";
import ToolHeader from "@/components/tool-header";
import ScorerRecorder from "@/components/scorer-recorder";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import type { PublicMatch } from "@/lib/dto";
import {
  applyBall,
  cloneMatch,
  expectedInnings,
  ExtraType,
  formatLabel,
  Innings,
  isSettled,
  makeInnings,
  MatchState,
  MAX_WICKET_LIMIT,
  maxWickets,
  oversString,
  resultText,
  RULE_PRESETS,
  scoreline,
  teamRuns,
  TEST_INNINGS,
  VENUES,
  wicketCap,
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
  /** Overs for the chase — defaults to `overs` when the sides don't revise it. */
  oversB?: number;
  /** Four innings per side, and overs that do not have to run out. */
  isTest?: boolean;
  /** Cap per Test innings; 0 or unset means bat until all out or declared. */
  testOvers?: number;
  /**
   * One player a side bats and bowls. The squad below stays intact so turning
   * this off brings the whole XI back rather than a roster the user has to
   * retype.
   */
  oneVOne?: boolean;
  /** Wickets each innings is played to; unset means all but the last batter. */
  wickets?: number;
  venue: string;
  ruleIds: string[];
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

/** Offline mirror of the live match so a refresh can pick up where you left off. */
const SCORER_STORE_KEY = "pavilion.scorer.v16";

/** Who takes the field: the whole squad, or only its first name in a 1 v 1. */
function rosterOf(team: TeamSetup, oneVOne: boolean): string[] {
  const players = team.players.map((player) => player.trim()).filter(Boolean);
  return oneVOne ? players.slice(0, 1) : players;
}

/**
 * What the next innings must chase: the opposition's total plus one in a
 * limited-overs game, the lead plus one in a Test's final innings, and nothing
 * in between. `null` also means "no chase applies" when a Test side is already
 * ahead — that is a result, not a target.
 */
function chaseTargetFor(
  match: MatchState,
  teamA: string,
  teamB: string
): number | null {
  const index = match.innings.length;
  if (!match.isTest) return index === 1 ? match.innings[0].runs + 1 : null;
  if (index !== TEST_INNINGS - 1) return null;
  const batting = index % 2 === 0 ? teamA : teamB;
  const bowling = batting === teamA ? teamB : teamA;
  const lead = teamRuns(match, bowling) - teamRuns(match, batting);
  return lead < 0 ? null : lead + 1;
}

interface StoredScorerState {
  match: MatchState;
  config: Config;
  savedAt: number;
}

function clearStoredMatch() {
  try {
    localStorage.removeItem(SCORER_STORE_KEY);
  } catch {
    /* ignore private-mode failures */
  }
}

export default function ScorerClient() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [view, setView] = useState<"setup" | "live" | "done">("setup");
  const [undoStack, setUndoStack] = useState<MatchState[]>([]);
  const [redoStack, setRedoStack] = useState<MatchState[]>([]);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [history, setHistory] = useState<PublicMatch[]>([]);
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const { message: toast, notify } = useToast();
  const savedRef = useRef(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const storedRef = useRef<StoredScorerState | null>(null);

  const isTest = Boolean(match?.isTest ?? config.isTest);

  /**
   * Overs a given innings may use. A Test innings runs until all out or a
   * declaration unless the scorer caps it, and `Infinity` says that without a
   * special case in the engine — `legalBalls >= Infinity * 6` never fires.
   */
  const oversFor = useCallback(
    (index: number): number => {
      if (isTest) {
        return config.testOvers && config.testOvers > 0
          ? config.testOvers
          : Number.POSITIVE_INFINITY;
      }
      return index === 1 ? config.oversB ?? config.overs : config.overs;
    },
    [isTest, config]
  );

  const currentOvers = oversFor(match?.current ?? 0);
  const formatTag = formatLabel(currentOvers, isTest);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let restoredFromServer = false;
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
          matches?: PublicMatch[];
        };
        if (cancelled) return;
        if (Array.isArray(matches.matches)) setHistory(matches.matches);
        const stored = state.state;
        if (stored?.match?.innings?.length) {
          restoredFromServer = true;
          setConfig(stored.config);
          setMatch(stored.match);
          const finished = isSettled(stored.match);
          savedRef.current = finished;
          setView(finished ? "done" : "live");
        }
      } catch {
        if (!cancelled) {
          setOffline(true);
          notify("Could not reach the server");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // No server session (or the server is unreachable) — offer the mirror.
          if (!restoredFromServer) {
            const local = readLocal(SCORER_STORE_KEY);
            if (local) {
              try {
                const parsed = JSON.parse(local) as Partial<StoredScorerState>;
                if (parsed.match?.innings?.length) {
                  storedRef.current = {
                    match: parsed.match,
                    config: parsed.config ?? DEFAULT_CONFIG,
                    savedAt: parsed.savedAt ?? Date.now(),
                  };
                  setResumePrompt(true);
                }
              } catch {
                /* ignore a corrupt autosave */
              }
            }
          }
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  // Offline mirror: keep localStorage in step with the live match + config.
  useEffect(() => {
    if (!match) return;
    // Finished matches are saved to the account instead. A Test is not finished
    // when its second innings ends — it has two more to mirror.
    if (isSettled(match)) return;
    writeLocal(
      SCORER_STORE_KEY,
      JSON.stringify({ match, config, savedAt: Date.now() })
    );
  }, [match, config]);

  useEffect(() => {
    if (!match || loading || view === "done") return;
    let cancelled = false;
    // Save on every delivery: a lost ball is worse than an extra request.
    fetch("/api/match-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match, config }),
    })
      .then((response) => {
        if (!cancelled) setOffline(!response.ok);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, [match, config, loading, view]);

  useEffect(() => {
    if (match && view === "live" && isSettled(match)) setView("done");
  }, [match, view]);

  useEffect(() => {
    if (!match || view !== "done" || !isSettled(match)) return;
    if (savedRef.current) return;
    savedRef.current = true;

    const entry = {
      format: formatLabel(config.overs, isTest),
      venue: config.venue,
      scoreline: scoreline(match, oversFor),
      result: resultText(match),
      innings: match.innings,
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
      const data = (await response.json()) as { match?: PublicMatch };
      if (data.match) {
        const saved = data.match;
        setHistory((prev) => [saved, ...prev].slice(0, 50));
      }
      await fetch("/api/match-state", { method: "DELETE" }).catch(() => null);
      clearStoredMatch();
    })();
  }, [match, view, config, isTest, oversFor]);

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
    setRedoStack([]);
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
      const updated = applyBall(innings, input, currentOvers, match.target);
      const nextMatch: MatchState = {
        ...match,
        innings: match.innings.map((item, index) =>
          index === match.current ? updated : item
        ),
      };
      setMatch(nextMatch);
      setWicketOpen(false);
      setRunsOpen(false);
      if (updated.done && match.innings.length < expectedInnings(match)) {
        notify("Innings over");
      }
    },
    [match, innings, currentOvers, pushUndo, notify]
  );

  const undo = useCallback(() => {
    if (!undoStack.length || !match) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-49), cloneMatch(match)]);
    setMatch(previous);
    setView("live");
    setWicketOpen(false);
    setRunsOpen(false);
    notify("Last ball undone");
  }, [undoStack, match, notify]);

  const redo = useCallback(() => {
    if (!redoStack.length || !match) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-49), cloneMatch(match)]);
    setMatch(next);
    setView("live");
    setWicketOpen(false);
    setRunsOpen(false);
    notify("Ball restored");
  }, [redoStack, match, notify]);

  const pickBowler = useCallback(
    (name: string) => {
      if (!match || !innings || !name) return;
      if (name === innings.lastBowler && innings.bowlers.length > 1) {
        notify("A bowler cannot bowl consecutive overs");
        return;
      }
      setMatch({
        ...match,
        innings: match.innings.map((item, index) =>
          index === match.current ? { ...item, bowler: name } : item
        ),
      });
    },
    [match, innings, notify]
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
    const nextConfig: Config = { ...config, teamA, teamB, oversB: undefined };
    const solo = Boolean(nextConfig.oneVOne);
    const first = makeInnings(
      teamA.name,
      teamB.name,
      rosterOf(teamA, solo),
      rosterOf(teamB, solo),
      nextConfig.wickets
    );
    setConfig(nextConfig);
    setMatch({
      innings: [first],
      current: 0,
      target: null,
      ...(nextConfig.isTest ? { isTest: true } : {}),
    });
    setUndoStack([]);
    setRedoStack([]);
    setView("live");
    setShowCard(false);
    savedRef.current = false;
    notify("Match started — pick the opening bowler");
  }, [config, notify]);

  /**
   * Begins the next innings: the chase in a limited-overs game, the third or
   * fourth in a Test. Sides always alternate, which is why a follow-on needs no
   * code here — after A, B, A the fourth innings is B whichever way it got
   * there. What a Test does need is the target for the final chase, which is
   * the *lead*, not the opposition's total.
   */
  const startNextInnings = useCallback(() => {
    if (!match) return;
    const index = match.innings.length;
    if (index >= expectedInnings(match)) return;

    // Sides come from the first innings rather than the live config, so
    // renaming a team mid-match cannot misalign the alternation.
    const opener = match.innings[0];
    const battingFirst = index % 2 === 0;
    const bat = battingFirst
      ? { name: opener.battingTeam, setup: config.teamA }
      : { name: opener.bowlingTeam, setup: config.teamB };
    const bowl = battingFirst
      ? { name: opener.bowlingTeam, setup: config.teamB }
      : { name: opener.battingTeam, setup: config.teamA };

    const target = chaseTargetFor(match, opener.battingTeam, opener.bowlingTeam);
    if (match.isTest && index === TEST_INNINGS - 1 && target === null) {
      notify(`${bat.name} are already ahead — close the match instead`);
      return;
    }

    pushUndo(match);
    const solo = Boolean(config.oneVOne);
    const next = makeInnings(
      bat.name,
      bowl.name,
      rosterOf(bat.setup, solo),
      rosterOf(bowl.setup, solo),
      config.wickets
    );
    setMatch({
      ...match,
      innings: [...match.innings, next],
      current: index,
      target,
    });
    setView("live");
    setShowCard(false);
    notify(target === null ? "Innings begin" : `Target: ${target}`);
  }, [match, config, pushUndo, notify]);

  /**
   * A Test decided without the last side ever batting again: A 100 and 100, B
   * 400/6 — B won with four wickets in hand and no fourth innings to score.
   */
  const decidedAhead = useCallback((): string | null => {
    if (!match?.isTest || match.innings.length < TEST_INNINGS - 1) return null;
    const closing = match.innings[match.innings.length - 1];
    const ahead = closing.bowlingTeam;
    const lead = teamRuns(match, ahead) - teamRuns(match, closing.battingTeam);
    if (lead <= 0) return null;
    const innings = match.innings.find((item) => item.battingTeam === ahead);
    if (!innings) return null;
    const left = wicketCap(innings) - innings.wickets;
    return `${ahead} won by ${left} wicket${left === 1 ? "" : "s"}`;
  }, [match]);

  /** Calls time: a draw, or the decision `decidedAhead` already found. */
  const closeMatch = useCallback(
    (recorded?: string) => {
      if (!match) return;
      const result = recorded ?? resultText({ ...match, complete: true });
      if (!recorded && !window.confirm(`Close this match as ${result}?`)) return;
      pushUndo(match);
      setMatch({ ...match, complete: true, recordedResult: result });
      setShowCard(false);
      setView("done");
      notify(recorded ? result : "Time called");
    },
    [match, pushUndo, notify]
  );

  const endInnings = useCallback(
    (declared = false) => {
      if (!match || !innings || innings.done) return;
      const label = declared ? "Declare" : "End innings";
      if (!window.confirm(`${label} now?`)) return;
      pushUndo(match);
      setMatch({
        ...match,
        innings: match.innings.map((item, index) =>
          index === match.current
            ? { ...item, done: true, bowler: null, ...(declared ? { declared: true } : {}) }
            : item
        ),
      });
    },
    [match, innings, pushUndo]
  );

  const resetToSetup = useCallback(() => {
    setMatch(null);
    setView("setup");
    setUndoStack([]);
    setRedoStack([]);
    setShowCard(false);
    savedRef.current = false;
    storedRef.current = null;
    setResumePrompt(false);
    clearStoredMatch();
    fetch("/api/match-state", { method: "DELETE" }).catch(() => null);
  }, []);

  const resumeStoredMatch = useCallback(() => {
    const stored = storedRef.current;
    if (stored) {
      setConfig(stored.config);
      setMatch(stored.match);
      setUndoStack([]);
      setRedoStack([]);
      const finished = isSettled(stored.match);
      savedRef.current = finished;
      setView(finished ? "done" : "live");
      if (finished) clearStoredMatch();
      notify("Match restored");
    }
    storedRef.current = null;
    setResumePrompt(false);
  }, [notify]);

  const discardStoredMatch = useCallback(() => {
    storedRef.current = null;
    setResumePrompt(false);
    clearStoredMatch();
    notify("Saved match discarded");
  }, [notify]);

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
    const lines = match.innings.map((inn, index) => {
      const limit = oversFor(index);
      return `${inn.battingTeam}: ${inn.runs}/${inn.wickets}${
        inn.declared ? " declared" : ""
      } (${oversString(inn.legalBalls)}${
        Number.isFinite(limit) ? `/${limit}` : ""
      })`;
    });
    const text = `🏏 Pundit Arena — Gully Scorer · ${formatTag}\n${lines.join(
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
  // An uncapped Test innings has no balls left to compute a required rate from.
  const ballsLeft = Number.isFinite(currentOvers)
    ? currentOvers * 6 - (innings?.legalBalls ?? 0)
    : null;
  const runsNeeded = match?.target != null && innings ? match.target - innings.runs : null;
  const rrr =
    match?.target != null && innings && ballsLeft !== null && ballsLeft > 0
      ? ((match.target - innings.runs) / (ballsLeft / 6))
      : null;

  // The innings break must quote the same target the button will set, so the
  // two cannot drift apart.
  const opener = match?.innings[0];
  const nextTarget =
    match && opener && innings?.done
      ? chaseTargetFor(match, opener.battingTeam, opener.bowlingTeam)
      : null;
  const inningsLeft = match ? expectedInnings(match) - match.innings.length : 0;
  const breakExpected = match ? expectedInnings(match) : 2;
  const decidedByLead = decidedAhead();

  /**
   * One-handed scoring. The keyboard covers the commonest deliveries so a
   * scorer with the phone on a table can tap through an over without hunting;
   * anything typed into a real field, and anything while a modal is open, is
   * never read as a shortcut.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (wicketOpen || extrasOpen || runsOpen) return;
      if (view !== "live" || !innings || innings.done || !innings.bowler) return;

      const key = event.key.toLowerCase();
      const input: { runs: number; extra?: ExtraType; wicket?: WicketType } | null =
        /^[0-6]$/.test(key)
          ? { runs: Number(key) }
          : key === "w"
          ? { runs: 0, extra: "wd" }
          : key === "n"
          ? { runs: 0, extra: "nb" }
          : null;

      if (input) {
        event.preventDefault();
        handleApply(input);
        return;
      }
      if (key === "x") {
        event.preventDefault();
        setWicketOpen(true);
        return;
      }
      if (key === "u") {
        event.preventDefault();
        undo();
        return;
      }
      if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleApply, innings, view, wicketOpen, extrasOpen, runsOpen, undo, redo]);

  return (
    // overflow-x-clip, not hidden: a scroll container here would stop the
    // sticky camera bar from sticking while the scorecard scrolls.
    <div className="min-h-screen text-white relative overflow-x-clip">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 right-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <Toast message={toast} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Match Scorer"
          title="Gully Scorer"
          blurb="Your street, your rules. Ball-by-ball scoring for any format — overs, a Test, or a turf 1 v 1 — with the camera rolling."
          gradient="from-emerald-300 via-teal-200 to-indigo-300"
        />

        {/* Mounted once, above every view: a recording must survive the jump
            from setup to live to the result, and stay reachable while scoring.
            top-14 clears the fixed site nav. */}
        {!loading && (
          <div className="sticky top-14 z-30 mb-5">
            <ScorerRecorder />
          </div>
        )}

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

        {!loading && resumePrompt && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="flex-1 text-sm font-semibold text-emerald-100">
              Resume your last match?
            </span>
            <button
              onClick={resumeStoredMatch}
              className="rounded-lg px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Resume
            </button>
            <button
              onClick={discardStoredMatch}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
            >
              Discard
            </button>
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
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">
                      Innings {match.current + 1} of {breakExpected}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-bold uppercase tracking-wider whitespace-nowrap">
                      {formatTag}
                    </span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {config.venue}
                    </span>
                    {innings.wicketLimit ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold uppercase tracking-wider whitespace-nowrap">
                        {innings.wickets}/{innings.wicketLimit} wickets
                      </span>
                    ) : null}
                    {innings.order.length === 1 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25 font-bold uppercase tracking-wider whitespace-nowrap">
                        1 v 1
                      </span>
                    ) : null}
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
                      {oversString(innings.legalBalls)}
                      {Number.isFinite(currentOvers) ? ` / ${currentOvers} overs` : " overs"}
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
                          Need {Math.max(runsNeeded, 0)}
                          {ballsLeft !== null ? ` from ${Math.max(ballsLeft, 0)}` : " to win"}
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
                {innings.done && inningsLeft > 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-3">{isTest ? "🏛️" : "🥤"}</div>
                    <h2 className="text-2xl font-black mb-1">
                      {isTest
                        ? `Break after innings ${match.innings.length} of ${breakExpected}`
                        : "Innings break"}
                    </h2>
                    <p className="text-slate-400 mb-1">
                      {innings.battingTeam} made{" "}
                      <span className="text-white font-bold">
                        {innings.runs}/{innings.wickets}
                      </span>
                      {innings.declared ? " declared" : ""} in{" "}
                      {oversString(innings.legalBalls)} overs.
                    </p>
                    <p className="text-slate-500 text-xs mb-3">
                      {scoreline(match, oversFor)}
                    </p>
                    {decidedByLead ? (
                      <p className="text-emerald-300 text-sm font-semibold mb-4">
                        {decidedByLead} — the fourth innings cannot change it.
                      </p>
                    ) : nextTarget !== null ? (
                      <p className="text-amber-300 text-sm mb-4">
                        {match.innings.length % 2 === 0
                          ? opener?.battingTeam
                          : opener?.bowlingTeam}{" "}
                        need {nextTarget} to win
                        {isTest
                          ? ` (the lead across ${match.innings.length} innings)`
                          : ""}
                        .
                      </p>
                    ) : (
                      <p className="text-slate-400 text-sm mb-4">
                        {match.innings.length % 2 === 0
                          ? opener?.battingTeam
                          : opener?.bowlingTeam}{" "}
                        bat next — no target yet.
                      </p>
                    )}
                    {!isTest && match.innings.length === 1 ? (
                      <div className="flex items-center justify-center gap-2 mb-5">
                        <span className="text-xs text-slate-400">Chase overs</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={config.oversB ?? config.overs}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setConfig({
                              ...config,
                              oversB: Math.min(
                                60,
                                Math.max(1, Number.isFinite(value) ? value : 1)
                              ),
                            });
                          }}
                          className="w-20 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <span className="text-[10px] text-emerald-300 font-semibold">
                          {formatLabel(config.oversB ?? config.overs, false)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={
                          decidedByLead
                            ? () => closeMatch(decidedByLead)
                            : startNextInnings
                        }
                        className="rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
                      >
                        {decidedByLead
                          ? "Record the result"
                          : nextTarget !== null
                          ? "Start the chase"
                          : `Start innings ${match.innings.length + 1}`}
                      </button>
                      {isTest ? (
                        <button
                          onClick={() => closeMatch()}
                          className="rounded-xl px-6 py-3 font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
                        >
                          Call time — drawn
                        </button>
                      ) : null}
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
                          {innings.bowlers.map((b) => {
                            const blocked =
                              b.name === innings.lastBowler &&
                              innings.bowlers.length > 1;
                            return (
                              <button
                                key={b.name}
                                onClick={() => pickBowler(b.name)}
                                disabled={blocked}
                                title={
                                  blocked
                                    ? "Bowled the previous over — cannot go back-to-back"
                                    : undefined
                                }
                                className="px-4 py-2 rounded-lg bg-slate-900/70 border border-slate-700/60 text-sm font-medium hover:border-amber-400/60 hover:text-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-700/60 disabled:hover:text-slate-200"
                              >
                                {b.name}
                                {blocked && (
                                  <span className="text-[10px] text-slate-500 ml-1">
                                    · just bowled
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[0, 1, 2, 3, 4, 6].map((run) => (
                        <button
                          key={run}
                          onClick={() => handleApply({ runs: run })}
                          disabled={!innings.bowler || innings.done}
                          aria-label={`${run} run${run === 1 ? "" : "s"} off the bat`}
                          className={`min-h-[64px] rounded-2xl text-3xl font-black font-mono border transition-all active:scale-95 ${
                            run === 6
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30"
                              : run === 4
                              ? "bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30"
                              : "bg-slate-800/80 border-slate-700/70 text-slate-100 hover:bg-slate-700/80"
                          } disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
                        >
                          {run}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <button
                        onClick={() => setWicketOpen(true)}
                        disabled={!innings.bowler || innings.done}
                        aria-label="Wicket"
                        className="min-h-[56px] rounded-2xl text-base font-black uppercase tracking-wider bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                      >
                        W
                      </button>
                      <button
                        onClick={() => handleApply({ runs: 0, extra: "wd" })}
                        disabled={!innings.bowler || innings.done}
                        aria-label="Wide, 1 run"
                        className="min-h-[56px] rounded-2xl text-base font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/50 text-amber-200 hover:bg-amber-500/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                      >
                        WD
                      </button>
                      <button
                        onClick={() => handleApply({ runs: 0, extra: "nb" })}
                        disabled={!innings.bowler || innings.done}
                        aria-label="No ball, 1 run"
                        className="min-h-[56px] rounded-2xl text-base font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/50 text-amber-200 hover:bg-amber-500/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                      >
                        NB
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setExtrasOpen(true)}
                        disabled={!innings.bowler || innings.done}
                        aria-label="Open the extras pad"
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-300/90 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Extras…
                      </button>
                      <button
                        onClick={() => setRunsOpen(true)}
                        disabled={!innings.bowler || innings.done}
                        aria-label="Add a custom number of runs"
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-sky-500/10 border border-sky-500/25 text-sky-300/90 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        N runs…
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
                        onClick={redo}
                        disabled={!redoStack.length}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        ↪ Redo
                      </button>
                      <button
                        onClick={() => setShowCard((v) => !v)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-all"
                      >
                        {showCard ? "Hide scorecard" : "Scorecard"}
                      </button>
                      <button
                        onClick={() => endInnings(isTest)}
                        disabled={innings.done}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-40 transition-all"
                      >
                        {isTest ? 'Declare' : 'End innings'}
                      </button>
                      <button
                        onClick={abandonMatch}
                        className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
                      >
                        Abandon
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2">
                      Keys: 0–6 runs · w wide · n no-ball · x how he is out · u
                      undo · y redo
                    </p>
                  </div>
                )}

                {showCard && (
                  <Scorecard innings={innings} overs={currentOvers} />
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
                    {innings.nonStriker >= 0 ? (
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
                    ) : (
                      <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
                        <div className="text-[11px] text-sky-200 font-semibold">
                          Batting alone — {striker?.name ?? "the batter"} comes
                          back after every dismissal.
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          {Math.max(wicketCap(innings) - innings.wickets, 0)} of{" "}
                          {wicketCap(innings)} wickets left
                          {striker?.dismissals
                            ? ` · out ${striker.dismissals}×`
                            : ""}
                        </div>
                      </div>
                    )}
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
                      {formatTag} ·{" "}
                      {Number.isFinite(currentOvers)
                        ? `${currentOvers} overs`
                        : "uncapped overs"}
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

            {extrasOpen && (
              <ExtrasModal
                onApply={(input) => handleApply(input)}
                onClose={() => setExtrasOpen(false)}
              />
            )}

            {runsOpen && (
              <RunsPad
                onApply={(runs) => handleApply({ runs })}
                onClose={() => setRunsOpen(false)}
              />
            )}
          </>
        )}

        {!loading && view === "done" && match && (
          <ResultScreen
            match={match}
            oversFor={oversFor}
            formatTag={formatTag}
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
  history: PublicMatch[];
  onDeleteMatch: (id: string) => void;
  formats: string[];
  formatFilter: string;
  setFormatFilter: (value: string) => void;
  legends: { name: string; runs: number; innings: number; best: number }[];
}) {
  const isTest = Boolean(config.isTest);
  const format = formatLabel(config.overs, isTest);
  const solo = Boolean(config.oneVOne);
  const squadA = rosterOf(config.teamA, solo);
  const squadB = rosterOf(config.teamB, solo);
  const squadWickets = maxWickets(squadA.length);

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

      {solo && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <span className="font-bold text-emerald-100">
            {squadA[0] ?? "Player 1"}{" "}
            <span className="text-emerald-400/70">v</span>{" "}
            {squadB[0] ?? "Player 2"}
          </span>
          <span className="text-emerald-200/70">
            {" "}— each bats and bowls alone, and comes back after every dismissal
            until the wicket count runs out. The rest of both squads stays on the
            bench; turn 1 v 1 off to bring them back.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Match settings
          </h3>

          <button
            onClick={() =>
              setConfig(
                solo
                  ? { ...config, oneVOne: false }
                  : {
                      ...config,
                      oneVOne: true,
                      isTest: true,
                      testOvers: 0,
                      venue: "Turf",
                      wickets: config.wickets ?? 3,
                    }
              )
            }
            aria-pressed={solo}
            className={`w-full text-left rounded-xl border px-4 py-3 mb-3 transition-all ${
              solo
                ? "bg-emerald-500/15 border-emerald-500/45"
                : "bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border-slate-700/60 hover:border-emerald-500/40"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">
                  {solo ? "1 v 1 is on" : "Turf 1 v 1 Test"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {solo
                    ? "Tap to bring the full squads back"
                    : "One player a side · two innings each · unlimited overs · your wicket count"}
                </div>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  solo
                    ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-100"
                    : "bg-slate-800/70 border-slate-700 text-slate-300"
                }`}
              >
                {solo ? "On" : "Set up"}
              </span>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[false, true].map((test) => (
              <button
                key={String(test)}
                onClick={() => setConfig({ ...config, isTest: test })}
                className={`rounded-xl px-4 py-3 text-left border transition-all ${
                  isTest === test
                    ? "bg-emerald-500/15 border-emerald-500/45"
                    : "bg-slate-900/50 border-slate-800/70 hover:border-slate-700"
                }`}
              >
                <div className="text-sm font-bold">
                  {test ? "Test" : "Limited overs"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {test
                    ? "Two innings each · declare · draw"
                    : "One innings each · a target"}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">
                {isTest ? "Overs per innings (0 = unlimited)" : "Overs (1–60)"}
              </label>
              <input
                type="number"
                min={isTest ? 0 : 1}
                max={isTest ? 90 : 60}
                value={isTest ? config.testOvers ?? 0 : config.overs}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const clean = Number.isFinite(value) ? value : 0;
                  setConfig(
                    isTest
                      ? { ...config, testOvers: Math.min(90, Math.max(0, clean)) }
                      : {
                          ...config,
                          overs: Math.min(60, Math.max(1, clean)),
                        }
                  );
                }}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="text-[11px] text-emerald-300 mt-1.5 font-semibold">
                {isTest
                  ? (config.testOvers ?? 0) > 0
                    ? `${config.testOvers} overs per innings`
                    : "Bat until all out or declare"
                  : format}
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
            <label
              htmlFor="wickets-per-innings"
              className="text-xs text-slate-500 mb-1.5 block"
            >
              Wickets per innings
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="wickets-per-innings"
                type="number"
                min={1}
                max={MAX_WICKET_LIMIT}
                value={config.wickets ?? ""}
                placeholder={String(squadWickets)}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") {
                    setConfig({ ...config, wickets: undefined });
                    return;
                  }
                  const value = Number(raw);
                  setConfig({
                    ...config,
                    wickets: Math.min(
                      MAX_WICKET_LIMIT,
                      Math.max(1, Number.isFinite(value) ? Math.round(value) : 1)
                    ),
                  });
                }}
                className="w-24 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {[1, 2, 3, 5, 10].map((count) => (
                <button
                  key={count}
                  onClick={() => setConfig({ ...config, wickets: count })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    config.wickets === count
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white"
                  }`}
                >
                  {count}
                </button>
              ))}
              <button
                onClick={() => setConfig({ ...config, wickets: undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  config.wickets === undefined
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white"
                }`}
              >
                Squad default
              </button>
            </div>
            <div className="text-[11px] text-emerald-300 mt-1.5 font-semibold">
              {config.wickets
                ? `${config.wickets} wicket${config.wickets === 1 ? "" : "s"} a side${
                    solo ? " — the batter returns after each one" : ""
                  }`
                : `All but the last batter (${squadWickets})`}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-slate-500 mb-1.5 block">
              {isTest ? "Quick overs per innings" : "Quick overs"}
            </label>
            <div className="flex flex-wrap gap-2">
              {(isTest ? [0, 10, 20, 30, 50] : [1, 2, 5, 6, 10, 20, 50]).map(
                (overs) => {
                  const active = isTest
                    ? (config.testOvers ?? 0) === overs
                    : config.overs === overs;
                  return (
                    <button
                      key={overs}
                      onClick={() =>
                        setConfig(
                          isTest
                            ? { ...config, testOvers: overs }
                            : { ...config, overs }
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white"
                      }`}
                    >
                      {overs === 0 ? "∞" : `${overs} ov`}
                    </button>
                  );
                }
              )}
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

const EXTRA_OPTIONS: {
  id: ExtraType;
  label: string;
  hint: string;
  allowZero: boolean;
}[] = [
  { id: "wd", label: "Wide", hint: "1 penalty run plus any runs the batters ran.", allowZero: true },
  { id: "nb", label: "No ball", hint: "1 penalty run plus runs off the bat.", allowZero: true },
  { id: "b", label: "Bye", hint: "Keeper misses — runs count as byes.", allowZero: false },
  { id: "lb", label: "Leg bye", hint: "Off the pad — runs count as leg byes.", allowZero: false },
];

function ExtrasModal({
  onApply,
  onClose,
}: {
  onApply: (input: { runs: number; extra: ExtraType }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<ExtraType>("wd");
  const [runs, setRuns] = useState(0);

  const option = EXTRA_OPTIONS.find((item) => item.id === type) ?? EXTRA_OPTIONS[0];
  const runChoices = option.allowZero ? [0, 1, 2, 3, 4] : [1, 2, 3, 4];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-md animate-bounce-in">
        <h3 className="text-lg font-black mb-1">Extras</h3>
        <p className="text-xs text-slate-500 mb-4">
          Wides and no-balls with runs, or byes and leg byes.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {EXTRA_OPTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setType(item.id);
                setRuns(item.allowZero ? 0 : 1);
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold border transition-all ${
                type === item.id
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                  : "bg-slate-800/70 border-slate-700/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 mb-2">{option.hint}</div>
        <div
          className={`grid ${
            option.allowZero ? "grid-cols-5" : "grid-cols-4"
          } gap-2 mb-4`}
        >
          {runChoices.map((value) => (
            <button
              key={value}
              onClick={() => setRuns(value)}
              className={`rounded-lg py-3 text-lg font-black font-mono border transition-all ${
                runs === value
                  ? "bg-slate-100/90 text-slate-900 border-transparent"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onApply({ runs, extra: type })}
            className="flex-1 rounded-lg py-3 text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-3 text-sm text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RunsPad({
  onApply,
  onClose,
}: {
  onApply: (runs: number) => void;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState(5);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-md animate-bounce-in">
        <h3 className="text-lg font-black mb-1">Runs off the bat</h3>
        <p className="text-xs text-slate-500 mb-4">
          For the awkward totals — overthrows, all-run fours, five off the pad.
        </p>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
            <button
              key={value}
              onClick={() => setRuns(value)}
              className={`rounded-lg py-3 text-lg font-black font-mono border transition-all ${
                runs === value
                  ? "bg-slate-100/90 text-slate-900 border-transparent"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onApply(runs)}
            className="flex-1 rounded-lg py-3 text-sm font-bold bg-gradient-to-r from-sky-500 to-indigo-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Add {runs} run{runs === 1 ? "" : "s"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-3 text-sm text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Scorecard({ innings, overs }: { innings: Innings; overs: number }) {
  const totalExtras =
    innings.extras.wd +
    innings.extras.nb +
    innings.extras.b +
    innings.extras.lb +
    innings.extras.penalty;
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
            {oversString(innings.legalBalls)}
            {Number.isFinite(overs) ? `/${overs} ov` : " ov"}
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
                      : (batter.dismissals ?? 0) > 0
                      ? "returned"
                      : batted
                      ? "not out"
                      : "did not bat"}
                    {(batter.dismissals ?? 0) > 1 ? (
                      <span className="text-slate-500">
                        {" "}· {batter.dismissals}× out
                      </span>
                    ) : null}
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
            {innings.extras.b ? `, b ${innings.extras.b}` : ""}
            {innings.extras.lb ? `, lb ${innings.extras.lb}` : ""}
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
  oversFor,
  formatTag,
  venue,
  onShare,
  onNew,
}: {
  match: MatchState;
  oversFor: (index: number) => number;
  formatTag: string;
  venue: string;
  onShare: () => void;
  onNew: () => void;
}) {
  const result = resultText(match);
  const last = match.innings[match.innings.length - 1];
  const chaseWon = Boolean(
    last?.done && match.target !== null && last.runs >= match.target
  );

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
        <div className="relative">
          <div className="text-5xl mb-3">{chaseWon ? "🏆" : "🏏"}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">
            Result · {formatTag} · {venue}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{result}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
            {match.innings.map((inn, index) => (
              <div
                key={`${inn.battingTeam}-${index}`}
                className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
              >
                <div className="text-[11px] text-slate-500 truncate">
                  {inn.battingTeam}
                </div>
                <div className="text-xl font-black font-mono">
                  {inn.runs}/{inn.wickets}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {oversString(inn.legalBalls)} ov
                  {inn.declared ? " · dec" : ""}
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

      {match.innings.map((inn, index) => (
        <Scorecard
          key={`${inn.battingTeam}-card-${index}`}
          innings={inn}
          overs={oversFor(index)}
        />
      ))}
    </div>
  );
}
