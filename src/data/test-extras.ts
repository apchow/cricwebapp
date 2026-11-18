import type { Player } from "@/types/player";

/**
 * Test-squad members with no row in the IPL-synced players.json. Merged
 * additively in player-db so scripts/sync-ipl-squads.mjs can regenerate the
 * JSON without dropping them. Ids sit far above the synced range.
 */
export const TEST_EXTRA_PLAYERS: Player[] = [
  {
    id: 9001,
    name: "Akash Deep",
    country: "IND",
    role: "Bowler",
    isActive: true,
    era: "current",
    team: "FREE AGENT",
    basePrice: 150,
    form: 78,
    ppImpact: 45,
    deathImpact: 55,
    vfm: 80,
    punditTag: "Solid",
    isUncapped: false,
  },
  {
    id: 9002,
    name: "Tom Blundell",
    country: "NZ",
    role: "Wicket-Keeper",
    isActive: true,
    era: "current",
    team: "FREE AGENT",
    basePrice: 150,
    form: 80,
    ppImpact: 55,
    deathImpact: 40,
    vfm: 78,
    punditTag: "Solid",
    isUncapped: false,
  },
];