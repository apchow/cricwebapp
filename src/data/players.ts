export type PlayerRole = "BAT" | "BOWL" | "AR" | "WK";

export interface Player {
  id: number;
  name: string;
  country: string;
  flag: string;
  role: PlayerRole;
  rating: number;
  battingStyle: string;
  bowlingStyle: string;
}

export const PLAYERS: Player[] = [
  // ─── INDIA ──────────────────────────────────
  { id: 1,  name: "Virat Kohli",       country: "IND", flag: "🇮🇳", role: "BAT",  rating: 95, battingStyle: "RHB", bowlingStyle: "RM" },
  { id: 2,  name: "Rohit Sharma",      country: "IND", flag: "🇮🇳", role: "BAT",  rating: 93, battingStyle: "RHB", bowlingStyle: "OB" },
  { id: 3,  name: "Jasprit Bumrah",    country: "IND", flag: "🇮🇳", role: "BOWL", rating: 96, battingStyle: "RHB", bowlingStyle: "RF" },
  { id: 4,  name: "Ravindra Jadeja",   country: "IND", flag: "🇮🇳", role: "AR",   rating: 89, battingStyle: "LHB", bowlingStyle: "SLA" },
  { id: 5,  name: "Rishabh Pant",      country: "IND", flag: "🇮🇳", role: "WK",   rating: 87, battingStyle: "LHB", bowlingStyle: "-" },
  { id: 6,  name: "Hardik Pandya",     country: "IND", flag: "🇮🇳", role: "AR",   rating: 86, battingStyle: "RHB", bowlingStyle: "RMF" },
  { id: 7,  name: "Mohammed Shami",    country: "IND", flag: "🇮🇳", role: "BOWL", rating: 88, battingStyle: "RHB", bowlingStyle: "RFM" },
  { id: 8,  name: "R Ashwin",          country: "IND", flag: "🇮🇳", role: "BOWL", rating: 90, battingStyle: "RHB", bowlingStyle: "OB" },
  { id: 9,  name: "Shubman Gill",      country: "IND", flag: "🇮🇳", role: "BAT",  rating: 85, battingStyle: "RHB", bowlingStyle: "-" },
  { id: 10, name: "KL Rahul",          country: "IND", flag: "🇮🇳", role: "WK",   rating: 84, battingStyle: "RHB", bowlingStyle: "-" },

  // ─── AUSTRALIA ──────────────────────────────
  { id: 11, name: "Steve Smith",       country: "AUS", flag: "🇦🇺", role: "BAT",  rating: 92, battingStyle: "RHB", bowlingStyle: "LB" },
  { id: 12, name: "Pat Cummins",       country: "AUS", flag: "🇦🇺", role: "BOWL", rating: 94, battingStyle: "RHB", bowlingStyle: "RF" },
  { id: 13, name: "Mitchell Starc",    country: "AUS", flag: "🇦🇺", role: "BOWL", rating: 91, battingStyle: "LHB", bowlingStyle: "LF" },
  { id: 14, name: "Travis Head",       country: "AUS", flag: "🇦🇺", role: "BAT",  rating: 87, battingStyle: "LHB", bowlingStyle: "OB" },
  { id: 15, name: "Mitchell Marsh",    country: "AUS", flag: "🇦🇺", role: "AR",   rating: 83, battingStyle: "RHB", bowlingStyle: "RMF" },
  { id: 16, name: "Josh Hazlewood",    country: "AUS", flag: "🇦🇺", role: "BOWL", rating: 89, battingStyle: "RHB", bowlingStyle: "RFM" },

  // ─── ENGLAND ────────────────────────────────
  { id: 17, name: "Joe Root",          country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "BAT",  rating: 93, battingStyle: "RHB", bowlingStyle: "OB" },
  { id: 18, name: "Ben Stokes",        country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "AR",   rating: 91, battingStyle: "LHB", bowlingStyle: "RMF" },
  { id: 19, name: "Jofra Archer",      country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "BOWL", rating: 88, battingStyle: "RHB", bowlingStyle: "RF" },
  { id: 20, name: "Jos Buttler",       country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "WK",   rating: 89, battingStyle: "RHB", bowlingStyle: "-" },
  { id: 21, name: "Harry Brook",       country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "BAT",  rating: 86, battingStyle: "RHB", bowlingStyle: "-" },
  { id: 22, name: "Mark Wood",         country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", role: "BOWL", rating: 85, battingStyle: "RHB", bowlingStyle: "RF" },

  // ─── NEW ZEALAND ────────────────────────────
  { id: 23, name: "Kane Williamson",   country: "NZ",  flag: "🇳🇿", role: "BAT",  rating: 91, battingStyle: "RHB", bowlingStyle: "OB" },
  { id: 24, name: "Trent Boult",       country: "NZ",  flag: "🇳🇿", role: "BOWL", rating: 90, battingStyle: "RHB", bowlingStyle: "LFM" },
  { id: 25, name: "Tim Southee",       country: "NZ",  flag: "🇳🇿", role: "BOWL", rating: 86, battingStyle: "RHB", bowlingStyle: "RFM" },
  { id: 26, name: "Tom Latham",        country: "NZ",  flag: "🇳🇿", role: "WK",   rating: 83, battingStyle: "LHB", bowlingStyle: "-" },

  // ─── PAKISTAN ────────────────────────────────
  { id: 27, name: "Babar Azam",        country: "PAK", flag: "🇵🇰", role: "BAT",  rating: 94, battingStyle: "RHB", bowlingStyle: "-" },
  { id: 28, name: "Shaheen Afridi",    country: "PAK", flag: "🇵🇰", role: "BOWL", rating: 90, battingStyle: "LHB", bowlingStyle: "LF" },
  { id: 29, name: "Mohammad Rizwan",   country: "PAK", flag: "🇵🇰", role: "WK",   rating: 87, battingStyle: "RHB", bowlingStyle: "-" },
  { id: 30, name: "Shadab Khan",       country: "PAK", flag: "🇵🇰", role: "AR",   rating: 82, battingStyle: "RHB", bowlingStyle: "LB" },

  // ─── SOUTH AFRICA ───────────────────────────
  { id: 31, name: "Kagiso Rabada",     country: "SA",  flag: "🇿🇦", role: "BOWL", rating: 92, battingStyle: "LHB", bowlingStyle: "RF" },
  { id: 32, name: "Quinton de Kock",   country: "SA",  flag: "🇿🇦", role: "WK",   rating: 88, battingStyle: "LHB", bowlingStyle: "-" },
  { id: 33, name: "Aiden Markram",     country: "SA",  flag: "🇿🇦", role: "AR",   rating: 84, battingStyle: "RHB", bowlingStyle: "OB" },
  { id: 34, name: "Anrich Nortje",     country: "SA",  flag: "🇿🇦", role: "BOWL", rating: 87, battingStyle: "RHB", bowlingStyle: "RF" },

  // ─── WEST INDIES ────────────────────────────
  { id: 35, name: "Nicholas Pooran",   country: "WI",  flag: "🌴", role: "WK",   rating: 85, battingStyle: "LHB", bowlingStyle: "-" },
  { id: 36, name: "Jason Holder",      country: "WI",  flag: "🌴", role: "AR",   rating: 84, battingStyle: "RHB", bowlingStyle: "RMF" },
  { id: 37, name: "Andre Russell",     country: "WI",  flag: "🌴", role: "AR",   rating: 88, battingStyle: "RHB", bowlingStyle: "RF" },

  // ─── OTHERS ─────────────────────────────────
  { id: 38, name: "Rashid Khan",       country: "AFG", flag: "🇦🇫", role: "BOWL", rating: 91, battingStyle: "RHB", bowlingStyle: "LB" },
  { id: 39, name: "Wanindu Hasaranga", country: "SL",  flag: "🇱🇰", role: "AR",   rating: 85, battingStyle: "RHB", bowlingStyle: "LB" },
  { id: 40, name: "Shakib Al Hasan",   country: "BAN", flag: "🇧🇩", role: "AR",   rating: 87, battingStyle: "LHB", bowlingStyle: "SLA" },
];

export const ROLE_LABELS: Record<PlayerRole, string> = {
  BAT: "Batter",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "Wicket-Keeper",
};

export const ROLE_COLORS: Record<PlayerRole, string> = {
  BAT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  BOWL: "bg-red-500/20 text-red-400 border-red-500/30",
  AR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  WK: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export const COUNTRIES = [...new Set(PLAYERS.map((p) => p.country))].sort();

export const COUNTRY_FLAGS: Record<string, string> = Object.fromEntries(
  PLAYERS.map((p) => [p.country, p.flag])
);

const BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

/** Resolve a stored XI's player ids into full player records, preserving order. */
export function playersById(ids: number[]): Player[] {
  return ids
    .map((id) => BY_ID.get(id))
    .filter((player): player is Player => Boolean(player));
}
