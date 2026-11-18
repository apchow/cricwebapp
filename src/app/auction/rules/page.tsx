import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Gavel,
  Globe,
  Landmark,
  ShieldAlert,
  Users,
} from "lucide-react";

import { getAuctionData } from "@/lib/auction/official";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "IPL 2027 Mini Auction Rules — Pundit Arena",
  description:
    "How the IPL 2027 mini auction works: ₹120cr salary cap, 18–25 squads, 8 overseas, no RTM, official purses and the bid ladder used by the simulator.",
};

export default function AuctionRulesPage() {
  const data = getAuctionData();
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <section className="glass rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/90 flex items-center gap-2">
            <Gavel className="h-4 w-4" /> The rulebook
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
            IPL 2027 mini auction rules
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            A mini auction, not a mega one: franchises keep whoever they want from their existing
            squad, there is no retention ceiling and no Right-to-Match. Whatever salary they kept
            on the books comes out of the ₹{data.salaryCapCr}cr cap — the rest is the auction purse.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-amber-400" /> Auction: 16 Dec 2026, {data.auctionVenue}
            </span>
            <span>Retention deadline was 17 Nov 2026</span>
            <span>Final auction register: 3 Dec 2026</span>
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">The real mechanics</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <RuleCard icon={Landmark} label="Salary cap" value={`₹${data.salaryCapCr}cr per franchise`} detail="Retention salaries plus auction spend must fit inside the cap. Purse = cap − retained salaries." />
            <RuleCard icon={Users} label="Squad size" value={`${data.minSquad}–${data.maxSquad} players`} detail="Retentions count towards the squad. Slots to fill = 25 − players kept." />
            <RuleCard icon={Globe} label="Overseas" value={`Max ${data.maxOverseas} in the squad`} detail="Overseas slots = 8 − overseas players kept. No overseas slot, no overseas bid." />
            <RuleCard icon={Gavel} label="No RTM, no ceiling" value="Mini-auction format" detail="Unlike the mega auction, there is no 6-player retention cap, no uncapped minimum and no Right-to-Match card." />
            <RuleCard icon={Users} label="Impact Player" value="Expected to continue" detail="The Impact Player substitute rule is likely to stay for 2027 — squad depth still matters." />
            <RuleCard icon={ShieldAlert} label="Trades" value="Window closed with retentions" detail="Pant↔Kuldeep, Hardik↔Arshdeep, Shami↔Curran and more moved before the deadline; trade-ins count as retentions." />
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Inside the simulator</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <p className="font-bold text-white">Bid ladder</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Up to ₹1cr: +₹0.2cr · ₹1–5cr: +₹0.25cr · ₹5–10cr: +₹0.5cr · above ₹10cr: +₹1cr.
                Base prices run ₹0.2–0.3cr for uncapped players and ₹0.5–2cr for capped players by
                impact tier.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <p className="font-bold text-white">Rival paddles</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nine AI franchises bid to role needs, an editorial market value and their purse —
                richer teams push harder, and everyone keeps a base-price reserve for remaining
                slots. No rival can overspend or break the overseas cap.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <p className="font-bold text-white">Sets & hammer</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Marquee players first, then batters & keepers, all-rounders, bowlers, uncapped last.
                When bidding stalls the hammer counts 3-2-1 — jump in late or let it fall. Unsold
                players stay unsold in this sim.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
              <p className="font-bold text-white">Custom retentions</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Keep anyone from the full 2026 roster at your own price (₹0.2–25cr). Purse, slots
                and overseas slots recompute live; anyone you release joins the auction pool.
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Data & honesty</h2>
          <p className="text-sm text-slate-300">{data.source}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{data.note}</p>
          <p className="text-xs text-slate-500">
            Cricsheet data is ODC-By 1.0 (XML subset CC BY 4.0). Pundit Arena is a fan-made
            simulation — reputation-coin crore only, no real money, betting, odds or crypto, and no
            affiliation with the BCCI or IPL.
          </p>
          <div className="pt-2">
            <Link
              href="/auction"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-sm font-black text-slate-950 hover:from-amber-300 hover:to-amber-500 transition"
            >
              Take a paddle <ArrowRight className="h-4 w-4" />
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
        <Icon className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <p className="text-xs text-slate-500 leading-snug">{detail}</p>
    </div>
  );
}