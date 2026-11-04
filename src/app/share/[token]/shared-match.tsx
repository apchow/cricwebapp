"use client";

import Link from "next/link";

import { MatchScorecard } from "@/components/scorecard";
import { matchDate } from "@/lib/dates";
import type { PublicMatch } from "@/lib/dto";

export default function SharedMatch({ match }: { match: PublicMatch }) {
  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold">
            Pundit Arena · Shared scorecard
          </span>
          <Link
            href="/scorer"
            className="text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            Score your own match →
          </Link>
        </div>

        <div className="glass rounded-3xl p-6 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
            {match.format} · {match.venue} · {matchDate(match.createdAt)}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-mono mb-1">
            {match.scoreline}
          </h1>
          <p className="text-emerald-300 font-semibold">{match.result}</p>
        </div>

        <MatchScorecard innings={match.innings} />
      </div>
    </div>
  );
}
