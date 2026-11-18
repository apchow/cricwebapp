import {
  AUCTION_RULES,
  type AuctionPlayer,
  type OfficialTeam,
} from "./data.ts";

export interface CustomPick {
  playerId: string;
  priceCr: number;
}

export interface RetentionPlan {
  mode: "official" | "custom";
  teamId: string;
  retained: AuctionPlayer[];
  /** playerId -> price paid (custom mode only; official salaries unpublished). */
  prices: Record<string, number>;
  spendCr: number;
  purseCr: number;
  slots: number;
  overseasSlots: number;
  errors: string[];
  warnings: string[];
  valid: boolean;
}

export const MIN_PRICE_CR = 0.2;
export const MAX_PRICE_CR = 25;

export function clampPrice(v: number): number {
  return Math.min(MAX_PRICE_CR, Math.max(MIN_PRICE_CR, Math.round(v * 100) / 100));
}

/** The full roster a franchise could have kept: retained + released lists. */
export function rosterFor(team: OfficialTeam): AuctionPlayer[] {
  return [...team.retained, ...team.released].sort(
    (a, b) => b.valueCr - a.valueCr || b.impact - a.impact
  );
}

export function officialPlan(team: OfficialTeam): RetentionPlan {
  return {
    mode: "official",
    teamId: team.id,
    retained: team.retained,
    prices: {},
    spendCr: Math.round((AUCTION_RULES.salaryCapCr - team.purseCr) * 100) / 100,
    purseCr: team.purseCr,
    slots: team.slots,
    overseasSlots: team.overseasSlots,
    errors: [],
    warnings: [],
    valid: true,
  };
}

/**
 * Custom retentions: purse = 120 − spend, slots = 25 − count,
 * overseas slots = 8 − overseas count. The purse must still cover the
 * minimum base price of every remaining slot or the squad can never be
 * completed, so that is an error, not a warning.
 */
export function customPlan(team: OfficialTeam, picks: CustomPick[]): RetentionPlan {
  const meta = AUCTION_RULES;
  const roster = new Map(rosterFor(team).map((p) => [p.id, p]));
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Set<string>();
  const retained: AuctionPlayer[] = [];
  const prices: Record<string, number> = {};
  let spend = 0;
  let overseas = 0;

  for (const pick of picks) {
    const player = roster.get(pick.playerId);
    if (!player || seen.has(pick.playerId)) continue;
    seen.add(pick.playerId);
    const price = clampPrice(pick.priceCr);
    retained.push(player);
    prices[player.id] = price;
    spend += price;
    if (player.overseas) overseas += 1;
  }
  spend = Math.round(spend * 100) / 100;

  const purse = Math.round((meta.salaryCapCr - spend) * 100) / 100;
  const slots = meta.maxSquad - retained.length;
  const overseasSlots = meta.maxOverseas - overseas;

  if (retained.length === 0) {
    errors.push("Retain at least one player, or switch to the official retentions.");
  }
  if (retained.length > meta.maxSquad) {
    errors.push(`A squad holds at most ${meta.maxSquad} players.`);
  }
  if (overseas > meta.maxOverseas) {
    errors.push(`At most ${meta.maxOverseas} overseas players (you kept ${overseas}).`);
  }
  if (purse < 0) {
    errors.push(`Retention spend exceeds the ₹${meta.salaryCapCr}cr salary cap.`);
  } else if (slots > 0 && purse + 1e-9 < MIN_PRICE_CR * slots) {
    errors.push(
      `₹${purse.toFixed(2)}cr left cannot fill ${slots} slots at the ₹${MIN_PRICE_CR}cr minimum base price.`
    );
  }

  if (retained.length > 0 && errors.length === 0) {
    if (slots === 0) warnings.push("Squad already full — nothing left to buy at the auction.");
    if (purse > 0 && purse < 2 * slots) {
      warnings.push("Tight purse — most remaining slots will go at base price.");
    }
    if (overseasSlots === 0) warnings.push("No overseas slots left for the auction.");
    const uncapped = retained.filter((p) => p.uncapped).length;
    if (uncapped === 0) warnings.push("No uncapped player retained — cheap gems will cost you.");
  }

  return {
    mode: "custom",
    teamId: team.id,
    retained,
    prices,
    spendCr: spend,
    purseCr: purse,
    slots,
    overseasSlots,
    errors,
    warnings,
    valid: errors.length === 0 && retained.length > 0,
  };
}

/** Sensible starting point: keep the editorial top values under the cap. */
export function suggestCustom(team: OfficialTeam): CustomPick[] {
  const meta = AUCTION_RULES;
  const picks: CustomPick[] = [];
  let spend = 0;
  let overseas = 0;
  for (const p of rosterFor(team)) {
    if (picks.length >= 18) break;
    const price = clampPrice(Math.min(p.valueCr, 14));
    const slotsAfter = meta.maxSquad - (picks.length + 1);
    if (spend + price + 0.3 * slotsAfter > meta.salaryCapCr) continue;
    if (p.overseas && overseas >= meta.maxOverseas) continue;
    picks.push({ playerId: p.id, priceCr: price });
    spend += price;
    if (p.overseas) overseas += 1;
  }
  return picks;
}