import Link from "next/link";
import { ShieldCheck, Users, ArrowRight, Sparkles } from "lucide-react";

import ToolHeader from "@/components/tool-header";
import { getIplSquads } from "@/lib/retention/squads";
import { RETENTION_RULES } from "@/lib/retention/constants";

export const metadata = {
  title: "Retention 2027 — Pavilion XI",
  description:
    "Plan your six retentions: four capped, two uncapped, with prices, RTM picks and a shareable final roster.",
};

export const dynamic = "force-dynamic";

export default function RetentionPage() {
  const { season, teams } = getIplSquads();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-orange-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Auction Room"
          title="Retention 2027"
          blurb="Pick the six you refuse to lose. Four capped, two uncapped, prices within the cap — then lock and share."
          gradient="from-emerald-200 via-white to-orange-200"
        />

        <section className="glass rounded-2xl p-5 mb-6 space-y-2">
          <p className="text-sm text-slate-300">
            Build your IPL 2027 retention plan:{" "}
            <span className="font-bold text-emerald-300">
              {RETENTION_RULES.maxRetained} retentions
            </span>
            , at least{" "}
            <span className="font-bold text-amber-300">
              {RETENTION_RULES.minUncapped} uncapped
            </span>
            , prices ₹{RETENTION_RULES.minPriceCr}–{RETENTION_RULES.maxPriceCr}cr, total spend up to ₹
            {RETENTION_RULES.retentionCapCr}cr, and RTM prices up to ₹
            {RETENTION_RULES.maxRtmPerPlayerCr}cr.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Provisional until BCCI confirms IPL 2027 mechanics.
            </span>
            <span>Reputation-coin crore only — no real money, betting, odds, or crypto.</span>
            {season ? <span>Pool season: {season}</span> : null}
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" /> Squads
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pools derived from the latest Cricsheet IPL season, topped up from the previous
                season. Not official 2027 squads.
              </p>
            </div>
            <Link
              href="/retention/rules"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300"
            >
              View rules <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {teams.map((t) => {
              const squad = t.squad;
              const uncapped = squad.filter((p) => p.uncapped).length;
              const overseas = squad.filter((p) => p.overseas).length;
              const topValue = squad.length
                ? Math.max(...squad.map((p) => p.retentionValue))
                : 0;
              const topPlayers = squad
                .slice(0, 3)
                .map((p) => p.name)
                .join(" • ");

              return (
                <Link
                  key={t.id}
                  href={`/retention/${t.id}`}
                  className="group rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 hover:border-emerald-500/50 hover:bg-slate-900 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        borderColor: t.color + "40",
                        color: t.color,
                        backgroundColor: t.color + "10",
                      }}
                    >
                      {t.short}
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums">{squad.length}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition truncate">
                    {t.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                    <div className="flex gap-2 tabular-nums">
                      <span>👥 {squad.length}</span>
                      <span>🆓 {uncapped}</span>
                      <span>🌍 {overseas}</span>
                    </div>
                    <div className="tabular-nums text-slate-500">
                      Top ₹{topValue.toFixed(1)}cr
                    </div>
                    <p className="text-[10px] line-clamp-1 text-slate-500">{topPlayers}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 mt-6 border-l-2 border-emerald-500/40 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" /> How it works
          </h2>
          <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1.5">
            <li>Pick a team and open its planner.</li>
            <li>Retain up to {RETENTION_RULES.maxRetained} players — at least {RETENTION_RULES.minUncapped} uncapped.</li>
            <li>Set each retention price between ₹{RETENTION_RULES.minPriceCr}cr and ₹{RETENTION_RULES.maxPriceCr}cr.</li>
            <li>Keep the total at or below ₹{RETENTION_RULES.retentionCapCr}cr.</li>
            <li>Add RTM picks up to ₹{RETENTION_RULES.maxRtmPerPlayerCr}cr each.</li>
            <li>Finalise, then copy or share your locked six.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
