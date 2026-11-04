/**
 * Pundit Arena — IPL retention planner rules (shared constants).
 *
 * Labels are provisional until BCCI confirms IPL 2027 retention mechanics.
 * All money is reputation-coin value expressed in crore (cr); no real cash,
 * betting, odds, or crypto is involved.
 */

export const RETENTION_RULES = {
  id: "ipl-2027",
  label: "IPL 2027 Retention",
  provisional: true,
  maxRetained: 6,
  minUncapped: 2,
  maxUncapped: 2,
  minPriceCr: 4,
  maxPriceCr: 18,
  retentionCapCr: 80,
  maxRtmPerPlayerCr: 23,
  auctionPurseCr: 120,
  minSquad: 18,
  maxSquad: 25,
  maxOverseas: 8,
} as const;

export const DEFAULT_RTM_COUNT = 4;
