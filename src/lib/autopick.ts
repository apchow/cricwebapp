import type { Player, PlayerRole } from "@/types/player";

/**
 * Auto-picks a balanced, rule-legal XI from a squad pool.
 *
 * Rules enforced (matching the XI Builder validation):
 *  - exactly `size` players (default 11)
 *  - at most `maxOverseas` overseas players (default 4)
 *  - at least one wicket-keeper
 *  - at least five bowling options (bowlers + all-rounders)
 *
 * Selection is greedy by form. The mandatory roles are filled first so the
 * overseas budget is never spent before the must-have slots are covered.
 */

const INDIAN_COUNTRY = "IND";

/**
 * Mirrors `isOverseas` in `src/data/teams.ts`, kept local so this module stays
 * dependency-free and can be unit-tested by the bare Node runner.
 */
function isOverseasCountry(country: string): boolean {
  return country !== INDIAN_COUNTRY;
}

/** Target composition for a T20 XI, filled in priority order. */
const ROLE_PLAN: { role: PlayerRole; count: number }[] = [
  { role: "Wicket-Keeper", count: 1 },
  { role: "Bowler", count: 4 },
  { role: "All-Rounder", count: 2 },
  { role: "Batter", count: 4 },
];

export interface AutoPickOptions {
  /** Total players to select. Defaults to 11. */
  size?: number;
  /** Maximum overseas players allowed. Defaults to 4. */
  maxOverseas?: number;
  /**
   * Auction purse in lakhs. When set, the XI is kept within this spend using
   * base prices, so it can be assembled at auction. Omit for an unlimited buy.
   */
  budget?: number;
}

export interface AutoPickResult {
  /** The selected XI, laid out in batting order. */
  players: Player[];
  /** How many of each role the XI contains. */
  composition: Record<PlayerRole, number>;
  /** Number of overseas players selected. */
  overseas: number;
  /** Combined base price of the XI, in lakhs. */
  spend: number;
  /** Human-readable reasons the XI is not fully legal, if any. */
  unmet: string[];
}

function emptyComposition(): Record<PlayerRole, number> {
  return { Batter: 0, Bowler: 0, "All-Rounder": 0, "Wicket-Keeper": 0 };
}

/** Groups the chosen players into a sensible top-to-bottom batting order. */
function battingOrder(players: Player[]): Player[] {
  const batters = players.filter((player) => player.role === "Batter");
  const keepers = players.filter((player) => player.role === "Wicket-Keeper");
  const allRounders = players.filter(
    (player) => player.role === "All-Rounder"
  );
  const bowlers = players.filter((player) => player.role === "Bowler");
  return [
    ...batters.slice(0, 2),
    ...keepers,
    ...batters.slice(2),
    ...allRounders,
    ...bowlers,
  ];
}

export function autoPickXI(
  pool: Player[],
  options: AutoPickOptions = {}
): AutoPickResult {
  const size = Math.max(0, options.size ?? 11);
  const maxOverseas = Math.max(0, options.maxOverseas ?? 4);
  const budget = options.budget ?? null;

  const seen = new Set<number>();
  const candidates = pool
    .filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    })
    .sort((a, b) => b.form - a.form || b.vfm - a.vfm || a.id - b.id);

  const chosen: Player[] = [];
  const chosenIds = new Set<number>();
  let overseas = 0;
  let spend = 0;

  const byPrice = [...candidates].sort((a, b) => a.basePrice - b.basePrice);

  /** Cheapest possible cost of filling `count` further slots, or Infinity. */
  function cheapestFill(excludeId: number, count: number): number {
    if (count <= 0) return 0;
    let total = 0;
    let filled = 0;
    for (const player of byPrice) {
      if (filled >= count) break;
      if (player.id === excludeId || chosenIds.has(player.id)) continue;
      total += player.basePrice;
      filled += 1;
    }
    return filled >= count ? total : Number.POSITIVE_INFINITY;
  }

  function fitsBudget(player: Player, reserve: boolean): boolean {
    if (budget === null) return true;
    const cost = spend + player.basePrice;
    if (cost > budget) return false;
    if (!reserve) return true;
    return (
      cost + cheapestFill(player.id, size - chosen.length - 1) <= budget
    );
  }

  const canTake = (player: Player, reserve: boolean) =>
    !chosenIds.has(player.id) &&
    (!isOverseasCountry(player.country) || overseas < maxOverseas) &&
    fitsBudget(player, reserve);

  const take = (player: Player) => {
    chosenIds.add(player.id);
    chosen.push(player);
    spend += player.basePrice;
    if (isOverseasCountry(player.country)) overseas += 1;
  };

  const takeRole = (role: PlayerRole, count: number, reserve: boolean) => {
    let need = count;
    for (const player of candidates) {
      if (need <= 0 || chosen.length >= size) break;
      if (player.role !== role || !canTake(player, reserve)) continue;
      take(player);
      need -= 1;
    }
  };

  // First pass reserves purse for every remaining slot, so two big names cannot
  // strand the XI; the second pass spends what is left to fill any short role.
  for (const { role, count } of ROLE_PLAN) takeRole(role, count, true);
  for (const player of candidates) {
    if (chosen.length >= size) break;
    if (canTake(player, true)) take(player);
  }
  for (const { role, count } of ROLE_PLAN) takeRole(role, count, false);
  for (const player of candidates) {
    if (chosen.length >= size) break;
    if (canTake(player, false)) take(player);
  }

  const composition = emptyComposition();
  for (const player of chosen) composition[player.role] += 1;

  const bowlingOptions = composition.Bowler + composition["All-Rounder"];
  const unmet: string[] = [];
  if (chosen.length < size) {
    unmet.push(
      budget === null
        ? `Only ${chosen.length} players available`
        : `Only ${chosen.length} of ${size} fit the ₹${budget}l purse`
    );
  }
  if (composition["Wicket-Keeper"] < 1) {
    unmet.push("No wicket-keeper available");
  }
  if (bowlingOptions < 5) {
    unmet.push("Fewer than 5 bowling options");
  }

  return {
    players: battingOrder(chosen),
    composition,
    overseas,
    spend,
    unmet,
  };
}
