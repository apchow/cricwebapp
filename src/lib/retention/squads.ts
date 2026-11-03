import raw from "@/data/ipl-squads.json";
import type { RetentionPlayer } from "./rules";

export interface RetentionTeam {
  id: string;
  name: string;
  short: string;
  color: string;
  ink: string;
  match?: string;
  squad: RetentionPlayer[];
}

export interface IplSquads {
  season: string;
  note: string;
  teams: RetentionTeam[];
}

type RawPlayer = {
  id?: string;
  name?: string;
  shortName?: string;
  role?: string;
  country?: string;
  overseas?: boolean;
  uncapped?: boolean;
  impact?: number;
  retentionValue?: number;
  matches?: number;
  seasonMatches?: number;
  latestSeasonMatches?: number;
  lastSeason?: string;
  runs?: number;
  balls?: number;
  strikeRate?: number | null;
  wickets?: number;
  economy?: number | null;
  lastPlayed?: string | null;
};

type RawTeam = {
  id?: string;
  name?: string;
  short?: string;
  color?: string;
  ink?: string;
  match?: string;
  squad?: RawPlayer[];
};

type RawSquads = { season?: string; note?: string; teams?: RawTeam[] };

function toPlayer(p: RawPlayer): RetentionPlayer {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? "Unknown"),
    shortName: p.shortName,
    role: String(p.role ?? "BAT"),
    country: String(p.country ?? "India"),
    overseas: Boolean(p.overseas),
    uncapped: Boolean(p.uncapped),
    impact: Number(p.impact ?? 0),
    retentionValue: Number(p.retentionValue ?? 4),
    iplMatches: Number(p.matches ?? 0),
    seasonMatches: Number(p.seasonMatches ?? 0),
    latestSeasonMatches: Number(p.latestSeasonMatches ?? 0),
    lastSeason: String(p.lastSeason ?? ""),
    runs: Number(p.runs ?? 0),
    balls: Number(p.balls ?? 0),
    strikeRate: p.strikeRate ?? null,
    wickets: Number(p.wickets ?? 0),
    economy: p.economy ?? null,
    lastPlayed: p.lastPlayed ?? null,
  };
}

/** Static IPL squad pool used by the retention planner. */
export function getIplSquads(): IplSquads {
  const data = raw as unknown as RawSquads;
  return {
    season: String(data.season ?? ""),
    note: String(data.note ?? ""),
    teams: (data.teams ?? []).map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.name ?? ""),
      short: String(t.short ?? ""),
      color: String(t.color ?? "#22c55e"),
      ink: String(t.ink ?? "#0a0f1a"),
      match: t.match,
      squad: (t.squad ?? []).map(toPlayer),
    })),
  };
}
