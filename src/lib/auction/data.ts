export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface AuctionPlayer {
  id: string;
  name: string;
  role: Role;
  country: string;
  overseas: boolean;
  uncapped: boolean;
  /** Editorial 0–100 rating that drives AI interest and base prices. */
  impact: number;
  /** Editorial market value in cr — the ceiling rivals bid around. */
  valueCr: number;
  basePriceCr: number;
  iplMatches: number;
  runs: number;
  wickets: number;
  strikeRate: number | null;
  economy: number | null;
  /** Most recent IPL season form — drives realistic rival valuation. */
  seasonRuns: number;
  seasonBalls: number;
  seasonWickets: number;
  seasonStrikeRate: number | null;
  seasonEconomy: number | null;
  latestSeasonMatches: number;
  formerTeam: string;
}

export interface OfficialTeam {
  id: string;
  name: string;
  short: string;
  color: string;
  ink: string;
  purseCr: number;
  slots: number;
  overseasSlots: number;
  trades: { in: string[]; out: string[] };
  /** Retired from IPL — announced, but never enters the auction pool. */
  retired: string[];
  unlistedReleased: string[];
  retained: AuctionPlayer[];
  released: AuctionPlayer[];
}

export interface AuctionMeta {
  season: string;
  announced: string;
  auctionDate: string;
  auctionVenue: string;
  salaryCapCr: number;
  minSquad: number;
  maxSquad: number;
  maxOverseas: number;
  source: string;
  note: string;
}

export interface AuctionData extends AuctionMeta {
  teams: OfficialTeam[];
}

/** IPL 2027 mini-auction mechanics (no retention ceiling, no RTM). */
export const AUCTION_RULES = {
  salaryCapCr: 120,
  minSquad: 18,
  maxSquad: 25,
  maxOverseas: 8,
  minBaseCr: 0.2,
} as const;

export const SET_ORDER = [
  "Marquee",
  "Batters & Keepers",
  "All-rounders",
  "Bowlers",
  "Uncapped",
] as const;

export type SetName = (typeof SET_ORDER)[number];

export function setFor(p: AuctionPlayer): SetName {
  if (p.uncapped) return "Uncapped";
  if (p.valueCr >= 6) return "Marquee";
  if (p.role === "BAT" || p.role === "WK") return "Batters & Keepers";
  if (p.role === "AR") return "All-rounders";
  return "Bowlers";
}

export function formatCr(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `₹${r % 1 === 0 ? r.toFixed(0) : r.toFixed(2).replace(/0$/, "")}cr`;
}