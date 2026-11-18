import official from "@/data/ipl-2027-retentions.json";
import { getIplSquads } from "@/lib/retention/squads";
import type { AuctionData, AuctionMeta, AuctionPlayer, OfficialTeam } from "./data.ts";

const raw = official as unknown as AuctionMeta & {
  teams: Omit<OfficialTeam, "name" | "short" | "color" | "ink">[];
};

let cached: AuctionData | null = null;

/** Official 17 Nov 2026 retention state, joined to franchise branding. */
export function getAuctionData(): AuctionData {
  if (cached) return cached;
  const branding = new Map(getIplSquads().teams.map((t) => [t.id, t]));
  cached = {
    ...raw,
    teams: raw.teams.map((t) => {
      const b = branding.get(t.id);
      return {
        ...t,
        name: b?.name ?? t.id.toUpperCase(),
        short: b?.short ?? t.id.toUpperCase(),
        color: b?.color ?? "#f59e0b",
        ink: b?.ink ?? "#0a0f1a",
      };
    }),
  };
  return cached;
}

export function getAuctionTeam(id: string): OfficialTeam | undefined {
  return getAuctionData().teams.find((t) => t.id === id);
}

/** Everyone in the announced lists: retained + released across all teams. */
export function allAuctionPlayers(): AuctionPlayer[] {
  const seen = new Map<string, AuctionPlayer>();
  for (const t of getAuctionData().teams) {
    for (const p of [...t.retained, ...t.released]) seen.set(p.id, p);
  }
  return [...seen.values()];
}

/**
 * The players actually up for sale: everyone minus the players each team
 * kept. In custom mode the user's own retention choices replace the official
 * ones, so anyone they release joins the pool.
 */
export function buildPool(userTeamId: string, userRetainedIds: Set<string>): AuctionPlayer[] {
  const data = getAuctionData();
  const kept = new Set<string>(userRetainedIds);
  for (const t of data.teams) {
    if (t.id === userTeamId) continue;
    for (const p of t.retained) kept.add(p.id);
  }
  return allAuctionPlayers().filter((p) => !kept.has(p.id));
}