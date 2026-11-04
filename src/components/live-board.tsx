"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed, LiveMatch } from "@/lib/live";

const REFRESH_MS = 60_000;

function countdown(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function MatchRow({
  match,
  tone,
}: {
  match: LiveMatch;
  tone: "live" | "recent";
}) {
  const badge =
    tone === "live"
      ? "border-red-500/40 bg-red-500/15 text-red-300"
      : "border-slate-700/70 bg-slate-800/60 text-slate-400";

  return (
    <li className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{match.title}</div>
          <div className="text-[11px] text-slate-500 truncate">
            {match.matchType.toUpperCase()}
            {match.venue ? ` · ${match.venue}` : ""}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge}`}
        >
          {tone === "live" ? "live" : "result"}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {match.teams.map((team, index) => (
          <div key={`${team.name}-${index}`} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-slate-300 truncate">
              {team.name || team.short || "—"}
            </span>
            {team.score ? (
              <span className="text-xs font-mono text-slate-100">{team.score}</span>
            ) : null}
          </div>
        ))}
      </div>

      {match.status ? (
        <div className="mt-2 text-[11px] text-slate-400 leading-snug">{match.status}</div>
      ) : null}
    </li>
  );
}

export default function LiveBoard({ initial }: { initial?: LiveFeed }) {
  const [feed, setFeed] = useState<LiveFeed | null>(initial ?? null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      setFeed((await response.json()) as LiveFeed);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const empty = !feed || (!feed.live.length && !feed.recent.length);

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
          From the ground
        </h2>
        <span className="text-[11px] text-slate-600 font-mono">
          {failed
            ? "feed unreachable"
            : feed && feed.enabled
            ? `${feed.cached ? "cached" : "live fetch"} · ${feed.usedToday}/${
                feed.budget
              } today${
                feed.nextRefreshAt
                  ? ` · next ${countdown(feed.nextRefreshAt)}`
                  : ""
              }`
            : "add a key to switch on"}
        </span>
      </div>

      {empty ? (
        <div className="glass rounded-2xl px-6 py-8 text-center">
          <div className="text-3xl mb-3">{feed?.error ? "⚠️" : "📡"}</div>
          {feed && !feed.enabled ? (
            <>
              <p className="text-sm text-slate-300 font-semibold">
                Live scores are switched off
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Add <code className="font-mono">CRICAPI_KEY</code> to{" "}
                <code className="font-mono">cric-hub/.env</code> — a free key at
                cricapi.com — and this fills itself in.
              </p>
            </>
          ) : feed?.error ? (
            <>
              <p className="text-sm text-amber-300 font-semibold">
                Live feed needs attention
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {feed.error}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300 font-semibold">
                No international match in play
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Nothing live and nothing scheduled in the current window.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-red-300">
                Live now
              </h3>
              <span className="ml-auto text-[11px] text-slate-500 font-mono">
                {feed?.live.length ?? 0}
              </span>
            </div>
            {feed?.live.length ? (
              <ul className="space-y-2">
                {feed.live.slice(0, 4).map((match) => (
                  <MatchRow key={match.id} match={match} tone="live" />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Nothing in play this moment.</p>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                International results
              </h3>
              <span className="ml-auto text-[11px] text-slate-500 font-mono">
                {feed?.recent.length ?? 0}
              </span>
            </div>
            {feed?.recent.length ? (
              <ul className="space-y-2">
                {feed.recent.slice(0, 4).map((match) => (
                  <MatchRow key={match.id} match={match} tone="recent" />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                No completed international in the provider window.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
