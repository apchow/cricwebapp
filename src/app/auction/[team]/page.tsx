import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import AuctionExperience from "@/components/auction/auction-experience";
import { getAuctionData, getAuctionTeam } from "@/lib/auction/official";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }) {
  const { team: teamId } = await params;
  const team = getAuctionTeam(teamId);
  if (!team) return { title: "IPL Auction — Pundit Arena" };
  return {
    title: `${team.name} — IPL Auction 2027 — Pundit Arena`,
    description: `Run ${team.name}'s IPL 2027 mini auction: ₹${team.purseCr.toFixed(2)}cr purse, ${team.slots} slots, ${team.overseasSlots} overseas. Official or custom retentions, then live bidding.`,
  };
}

export default async function AuctionTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ team: teamId }, { mode }] = await Promise.all([params, searchParams]);
  const team = getAuctionTeam(teamId);
  if (!team) notFound();
  const { teams } = getAuctionData();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <Link
          href="/auction"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All franchises
        </Link>

        <AuctionExperience
          team={team}
          teams={teams}
          initialMode={mode === "custom" ? "custom" : "official"}
        />
      </div>
    </div>
  );
}