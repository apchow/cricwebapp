import Link from "next/link";
import type { Metadata } from "next";

import PlayerProfile from "./player-profile";
import { playerById } from "@/data/player-db";
import { battingStats, bowlingStats } from "@/lib/stats";
import { query } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Career figures for one player, reconstructed from every match scored in the
 * hub. The batting and bowling tables key on the player's display name, so we
 * pull the matching row straight out of the shared aggregation.
 */
async function careerFor(name: string) {
  return query((db) => ({
    batting: battingStats(db.matches).find((row) => row.name === name) ?? null,
    bowling: bowlingStats(db.matches).find((row) => row.name === name) ?? null,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = playerById(Number(id));
  if (!player) return { title: "Player not found — Pavilion XI" };
  return {
    title: `${player.name} — Pavilion XI`,
    description: `${player.role} · ${player.country} · ${player.team} — form, powerplay and death-overs profile plus career figures from scored matches.`,
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = playerById(Number(id));

  if (!player) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6 text-white">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-3">🏏</div>
          <h1 className="text-2xl font-black mb-2">Player not in the database</h1>
          <p className="text-sm text-slate-400 mb-6">
            We could not find that player. They may have been removed from the
            scouting pool, or the link may be malformed.
          </p>
          <Link
            href="/players"
            className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-sky-500 to-violet-500 hover:scale-[1.01] transition-all"
          >
            Back to the Stats Hub
          </Link>
        </div>
      </div>
    );
  }

  const career = await careerFor(player.name);

  return <PlayerProfile player={player} career={career} />;
}
