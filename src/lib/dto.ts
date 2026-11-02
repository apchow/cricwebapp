import type { Innings } from "@/lib/scoring";
import type { StoredMatch, StoredXI } from "@/lib/store";

/** XI as returned by `/api/xis` — no owner id, no internals. */
export interface PublicXI {
  id: string;
  name: string;
  players: number[];
  createdAt: string;
}

/** Saved match as returned by `/api/matches`, also used by the scorer history. */
export interface PublicMatch {
  id: string;
  createdAt: string;
  format: string;
  venue: string;
  scoreline: string;
  result: string;
  innings: Innings[];
}

export function toPublicXI(xi: StoredXI): PublicXI {
  return {
    id: xi.id,
    name: xi.name,
    players: xi.players,
    createdAt: xi.createdAt,
  };
}

export function toPublicMatch(match: StoredMatch): PublicMatch {
  return {
    id: match.id,
    createdAt: match.createdAt,
    format: match.format,
    venue: match.venue,
    scoreline: match.scoreline,
    result: match.result,
    innings: match.innings,
  };
}
