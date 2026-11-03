import Link from "next/link";
import {
  ShieldCheck,
  DollarSign,
  Users,
  ArrowRight,
  ShieldAlert,
  Clock,
} from "lucide-react";

import { RETENTION_RULES } from "@/lib/retention/constants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Retention Rules 2027 — Pavilion XI",
  description: "IPL 2027 retention and RTM rules used by the Pavilion XI planner.",
};

export default function RetentionRulesPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-orange-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <section className="glass rounded-2xl p-5 space-y-3">
          <h1 className="text-2xl font-black tracking-tight text-white">Retention rules — IPL 2027</h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert className="h-3 w-3 text-orange-400" />
            Provisional — BCCI has not confirmed final IPL 2027 retention mechanics. The planner is
            configurable and labeled provisional.
          </div>
        </section>

        <section className="glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Retention</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <RuleCard
              icon={Users}
              label="Retained players"
              value={`${RETENTION_RULES.maxRetained} maximum`}
              detail="Each team may retain up to 6 players before the auction."
            />
            <RuleCard
              icon={Users}
              label="Uncapped retentions"
              value={`${RETENTION_RULES.minUncapped} required`}
              detail="Of the 6 retentions, at least 2 must be uncapped (no international cap)."
            />
            <RuleCard
              icon={DollarSign}
              label="Retention price"
              value={`₹${RETENTION_RULES.minPriceCr}–${RETENTION_RULES.maxPriceCr}cr`}
              detail="Choose a price for every retained player within this band."
            />
            <RuleCard
              icon={ShieldCheck}
              label="Retention cap"
              value={`₹${RETENTION_RULES.retentionCapCr}cr total`}
              detail={`Combined price of all retained players must not exceed ₹${RETENTION_RULES.retentionCapCr}cr.`}
            />
            <RuleCard
              icon={DollarSign}
              label="RTM price"
              value={`Up to ₹${RETENTION_RULES.maxRtmPerPlayerCr}cr each`}
              detail={`RTM (Right to Match) picks carry a price up to ₹${RETENTION_RULES.maxRtmPerPlayerCr}cr per player.`}
            />
            <RuleCard
              icon={Clock}
              label="Status"
              value="Client-side only"
              detail="Plans are saved to your browser/localStorage; no real money, betting, odds, or crypto is involved."
            />
          </div>
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Data source</h2>
          <p className="text-sm text-slate-300">
            Squad pools are derived from Cricsheet scorecards (latest IPL season, topped up from the
            previous season). They are not official 2027 squads. Stats cover internationals and
            leagues worldwide.
          </p>
          <p className="text-xs text-slate-500">
            Cricsheet data is ODC-By 1.0; the XML subset is CC BY 4.0. Pavilion XI is reputation-coin
            only — no betting, no crypto, no cash.
          </p>
          <div className="pt-2">
            <Link
              href="/retention"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition"
            >
              Open planner <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function RuleCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <p className="text-xs text-slate-500 leading-snug">{detail}</p>
    </div>
  );
}
