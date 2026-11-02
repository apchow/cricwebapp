/** Canonical player model for the Pundit Arena database. */

export type PlayerRole = "Batter" | "Bowler" | "All-Rounder" | "Wicket-Keeper";

export type PlayerEra = "legend" | "modern" | "current";

export const IPL_TEAMS = [
  "CSK",
  "MI",
  "RCB",
  "KKR",
  "DC",
  "RR",
  "SRH",
  "PBKS",
  "GT",
  "LSG",
] as const;

export type IplTeam = (typeof IPL_TEAMS)[number];

/** Where a player sits when they are not attached to a franchise. */
export type PlayerTeam = IplTeam | "FREE AGENT";

export type PunditTag =
  | "Marquee"
  | "Steal"
  | "Watchlist"
  | "Solid"
  | "Punt"
  | "Overpriced";

export const PUNDIT_TAGS: PunditTag[] = [
  "Marquee",
  "Steal",
  "Watchlist",
  "Solid",
  "Punt",
  "Overpriced",
];

export interface Player {
  /** Stable numeric id, unique across the whole database. */
  id: number;
  name: string;
  /** ISO 3166-1 alpha-3 style code, e.g. "IND", "AUS". */
  country: string;
  role: PlayerRole;
  /** False for retired greats in the legends pool. */
  isActive: boolean;
  era: PlayerEra;
  team: PlayerTeam;
  /** Auction base price in lakhs. */
  basePrice: number;
  /** 0–100 current form. */
  form: number;
  /** 0–100 powerplay impact. */
  ppImpact: number;
  /** 0–100 death-overs impact. */
  deathImpact: number;
  /** 0–100 value for money at the listed base price. */
  vfm: number;
  punditTag: PunditTag;
  /** True for players yet to play international cricket. */
  isUncapped: boolean;
}

export interface PlayerDataset {
  version: string;
  updated: string;
  players: Player[];
}

/** Auction purse for a retention cycle, in lakhs (₹120 crore). */
export const TOTAL_PURSE = 12_000;

export const RETENTION_RULES = {
  max: 6,
  minCapped: 4,
  minUncapped: 2,
} as const;
