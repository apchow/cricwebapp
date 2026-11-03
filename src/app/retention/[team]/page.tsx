import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getIplSquads } from "@/lib/retention/squads";
import { RetentionPlanner } from "@/components/retention/RetentionPlanner";

export const dynamic = "force-dynamic";

export default async function RetentionTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: teamId } = await params;
  const { teams } = getIplSquads();
  const team = teams.find((t) => t.id === teamId);
  if (!team) notFound();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-orange-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Link
          href="/retention"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All squads
        </Link>

        <section className="glass rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold uppercase"
              style={{
                borderColor: team.color + "40",
                color: team.color,
                backgroundColor: team.color + "10",
              }}
            >
              {team.short}
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">{team.name}</h1>
          </div>
          <p className="text-sm text-slate-400">
            Retention planner for {team.name}. Squad pool derived from Cricsheet IPL data — not
            official 2027 squads.
          </p>
        </section>

        <Suspense fallback={<div className="glass rounded-2xl p-6 text-sm text-slate-400">Loading plan…</div>}>
          <RetentionPlanner
            team={{
              id: team.id,
              name: team.name,
              short: team.short,
              color: team.color,
              ink: team.ink,
            }}
            squad={team.squad}
          />
        </Suspense>
      </div>
    </div>
  );
}
