import type { IplTeam } from "@/types/player";

export interface TeamMeta {
  id: IplTeam;
  short: string;
  name: string;
  city: string;
  /** Hex used for the abbreviation chip and dots. */
  primary: string;
  /** Tailwind gradient for active chips and cards. */
  gradient: string;
  /** Tailwind ring/border colour when the team is selected. */
  ring: string;
}

export const TEAMS: TeamMeta[] = [
  {
    id: "CSK",
    short: "CSK",
    name: "Chennai Super Kings",
    city: "Chennai",
    primary: "#F9CD05",
    gradient: "from-yellow-400 to-amber-600",
    ring: "border-yellow-400/60",
  },
  {
    id: "MI",
    short: "MI",
    name: "Mumbai Indians",
    city: "Mumbai",
    primary: "#1D6BE0",
    gradient: "from-blue-500 to-indigo-700",
    ring: "border-blue-400/60",
  },
  {
    id: "RCB",
    short: "RCB",
    name: "Royal Challengers Bengaluru",
    city: "Bengaluru",
    primary: "#E4232B",
    gradient: "from-red-500 to-rose-700",
    ring: "border-red-400/60",
  },
  {
    id: "KKR",
    short: "KKR",
    name: "Kolkata Knight Riders",
    city: "Kolkata",
    primary: "#8B5CF6",
    gradient: "from-violet-500 to-purple-800",
    ring: "border-violet-400/60",
  },
  {
    id: "DC",
    short: "DC",
    name: "Delhi Capitals",
    city: "Delhi",
    primary: "#2563EB",
    gradient: "from-sky-500 to-blue-700",
    ring: "border-sky-500/60",
  },
  {
    id: "RR",
    short: "RR",
    name: "Rajasthan Royals",
    city: "Jaipur",
    primary: "#EA1A85",
    gradient: "from-pink-500 to-fuchsia-700",
    ring: "border-pink-400/60",
  },
  {
    id: "SRH",
    short: "SRH",
    name: "Sunrisers Hyderabad",
    city: "Hyderabad",
    primary: "#F26522",
    gradient: "from-orange-500 to-red-600",
    ring: "border-orange-500/60",
  },
  {
    id: "PBKS",
    short: "PBKS",
    name: "Punjab Kings",
    city: "Mohali",
    primary: "#D71920",
    gradient: "from-rose-500 to-red-700",
    ring: "border-rose-400/60",
  },
  {
    id: "GT",
    short: "GT",
    name: "Gujarat Titans",
    city: "Ahmedabad",
    primary: "#C9A227",
    gradient: "from-amber-500 to-slate-700",
    ring: "border-amber-400/60",
  },
  {
    id: "LSG",
    short: "LSG",
    name: "Lucknow Super Giants",
    city: "Lucknow",
    primary: "#00AEEF",
    gradient: "from-cyan-500 to-blue-700",
    ring: "border-cyan-500/60",
  },
];

const BY_ID = new Map(TEAMS.map((team) => [team.id, team]));

export function teamMeta(id: string): TeamMeta | null {
  return BY_ID.get(id as IplTeam) ?? null;
}

/** Overseas countries, used for the max-4-overseas XI rule. */
const INDIAN = "IND";

export function isOverseas(country: string): boolean {
  return country !== INDIAN;
}
