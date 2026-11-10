import dataset from "../../public/data/players.json";
import type { IplTeam, Player, PlayerDataset } from "@/types/player";

const data = dataset as unknown as PlayerDataset;

/** The full scouting database, active squad members plus the legends pool. */
export const PLAYERS: Player[] = data.players;

export const PLAYER_VERSION = data.version;
export const PLAYER_UPDATED = data.updated;

export const ACTIVE_PLAYERS = PLAYERS.filter((player) => player.isActive);
export const LEGENDS = PLAYERS.filter((player) => player.era === "legend");

const BY_ID = new Map(PLAYERS.map((player) => [player.id, player]));

export function playerById(id: number): Player | undefined {
  return BY_ID.get(id);
}

export function squadOf(team: IplTeam): Player[] {
  return PLAYERS.filter((player) => player.team === team && player.isActive);
}

/** Lakhs → the "₹4.0 Cr" label used across the auction UI. */
export function crores(lakhs: number): string {
  const value = lakhs / 100;
  return `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`;
}

/**
 * Pakistan players have never been part of the IPL, so a crore figure on them
 * is fiction. Null means "show no money", not "free".
 */
export function iplPriceOf(player: Player): number | null {
  return player.country === "PAK" ? null : player.basePrice;
}

export function lakhsToCrore(lakhs: number): number {
  return lakhs / 100;
}
