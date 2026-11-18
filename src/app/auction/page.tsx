import Link from "next/link";
import { Gavel, CalendarDays, MapPin, Users, ArrowRight, Sparkles, Landmark } from "lucide-react";

import AuctionCountdown from "@/components/auction/countdown";
import ModePicker, { type HubTeam } from "@/components/auction/mode-picker";
import { getAuctionData } from "@/lib/auction/official";

export const metadata = {
  title: "IPL Auction 2027 — Pundit Arena",
  description:
    "Run the IPL 2027 mini auction: official 17 November retentions or your own, live purse and slot math, then bid against nine rival franchises in the auction room.",
};

export const dynamic = "force-dynamic";

export default function AuctionPage() {
  const data = getAuctionData();
  const teams: HubTeam[] = [...data.teams]
    .sort((a, b) => b.purseCr - a.purseCr)
    .map((t) => ({
      id: t.id,
      name: t.name,
      short: t.short,
      color: t.color,
      purseCr: t.purseCr,
      slots: t.slots,
      overseasSlots: t.overseasSlots,
      retainedCount: t.retained.length,
      topRetained: [...t.retained]
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 3)
        .map((p) => p.name),
      hasTrades: t.trades.in.length > 0 || t.trades.out.length > 0,
      retired: t.retired,
    }));

  const totalPurse = data.teams.reduce((s, t) => s + t.purseCr, 0);
  const poolSize = data.teams.reduce((s, t) => s + t.released.length, 0);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[560px] h-[560px] bg-amber-600/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-[460px] h-[460px] bg-emerald-600/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/3 -left-20 w-[300px] h-[300px] bg-sky-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-400/90 mb-3">
            <Gavel className="h-4 w-4" />
            IPL 2027 · Mini Auction
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] text-amber-300 normal-case tracking-wider">
              <CalendarDays className="h-3 w-3" /> Dec 16
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[9px] text-slate-400 normal-case tracking-wider">
              <MapPin className="h-3 w-3" /> {data.auctionVenue}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                IPL AUCTION
              </h1>
              <p className="text-slate-400 mt-3 max-w-xl">
                The retentions are locked.{" "}
                <span className="text-amber-300 font-bold">₹{totalPurse.toFixed(2)}cr</span> burns a
                hole in ten pockets and <span className="text-white font-bold">{poolSize} players</span>{" "}
                wait for the hammer. Take a paddle — official lists or your own.
              </p>
            </div>
            <AuctionCountdown date={data.auctionDate} />
          </div>
        </header>

        <section className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-slate-900/60 px-4 py-3 mb-8 text-xs text-slate-300 flex flex-wrap gap-x-5 gap-y-1">
          <span className="font-black uppercase tracking-wider text-amber-400 text-[10px] self-center">
            Retention day fallout
          </span>
          <span>🐐 MS Dhoni retires from IPL — becomes CSK mentor</span>
          <span>Ajinkya Rahane retires</span>
          <span>Travis Head & Mitchell Starc released after confirming unavailability</span>
          <span className="inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3 text-sky-400" /> Pant, Hardik, Shami headline the trade window
          </span>
        </section>

        <ModePicker teams={teams} />

        <section className="glass rounded-2xl p-5 mt-8 border-l-2 border-amber-500/40">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-400" /> How the room works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3 text-sm text-slate-300">
            <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-amber-400 font-black text-lg">1</span>
              <p className="mt-1 font-bold text-white">Lock your retentions</p>
              <p className="text-xs text-slate-400 mt-1">
                Ride with the official 17 Nov lists, or keep your own players at your own prices —
                purse and slots update live.
              </p>
            </li>
            <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-amber-400 font-black text-lg">2</span>
              <p className="mt-1 font-bold text-white">Bid against nine rivals</p>
              <p className="text-xs text-slate-400 mt-1">
                Marquee sets first, IPL bid increments, a 3-2-1 hammer countdown. Rivals bid to their
                needs and their purse — outbid them or let them burn cash.
              </p>
            </li>
            <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-amber-400 font-black text-lg">3</span>
              <p className="mt-1 font-bold text-white">Face the verdict</p>
              <p className="text-xs text-slate-400 mt-1">
                Squad rating, best buy, total spend — then copy your squad for the group chat or run
                the whole auction back.
              </p>
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Landmark className="h-3 w-3 text-amber-400" />
              Purses & slots are official; player ratings are editorial. Pool provisional until the
              3 Dec register.
            </span>
            <span>Simulated crore only — no real money, betting, odds or crypto.</span>
            <Link href="/auction/rules" className="font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1">
              Full rules <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
          <Users className="h-3 w-3" />
          Lists: Cricbuzz, 17 Nov 2026 · stats: Cricsheet IPL 2026 · not affiliated with the BCCI or IPL
        </p>
      </div>
    </div>
  );
}