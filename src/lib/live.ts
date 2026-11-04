export interface LiveTeam {
  name: string;
  short: string;
  score?: string;
}

export interface LiveMatch {
  id: string;
  title: string;
  matchType: string;
  venue: string;
  teams: LiveTeam[];
  status: string;
  live: boolean;
  started: boolean;
  finished: boolean;
  startsAt: string | null;
  international: boolean;
}

export interface LiveFeed {
  enabled: boolean;
  error: string | null;
  live: LiveMatch[];
  upcoming: LiveMatch[];
  fetchedAt: string;
}

const INTERNATIONAL_TYPES = ["Test", "ODI", "T20I", "T20", "Women ODI", "Women T20I"];

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function first(value: unknown): string {
  const list = asArray(value);
  return str(list[0]);
}

/**
 * CricAPI's `current_matches` payload is loose: `status` and `score` are arrays
 * per innings, `teamInfo` may be missing on older series, and `startTimeUtc` can
 * be an empty string. Everything here degrades to an empty string rather than
 * throwing, because a bad payload should show an empty board, not a 500.
 */
export function normaliseCricApi(payload: unknown): LiveMatch[] {
  const rows = asArray(
    (payload as { data?: unknown })?.data ?? (payload as { matches?: unknown })?.matches
  );

  return rows
    .map((raw, index): LiveMatch | null => {
      const item = raw as Record<string, unknown>;
      if (!item || typeof item !== "object") return null;

      const id = str(item.id ?? item.matchId);
      if (!id) return null;

      const info = asArray(item.teamInfo).map((entry) => {
        const team = entry as Record<string, unknown>;
        return {
          name: str(team.name) || str(team.teamName),
          short: str(team.shortname) || str(team.shortName),
        };
      });
      const names = asArray(item.teams).map((name) => str(name)).filter(Boolean);
      const scores = asArray(item.score).map((entry) => {
        const innings = entry as Record<string, unknown>;
        const runs = innings.runs;
        const wickets = innings.wickets;
        const overs = innings.overs;
        if (runs === undefined) return "";
        return `${str(innings.team) || names[0] || ""} ${runs}${
          wickets !== undefined ? `/${wickets}` : ""
        }${overs !== undefined ? ` (${overs})` : ""}`.trim();
      });

      const teams: LiveTeam[] = (info.length ? info : names.map((name) => ({ name, short: "" })))
        .slice(0, 2)
        .map((team, position) => ({
          ...team,
          score: scores[position] || undefined,
        }));

      const started = item.matchStarted === true;
      const finished = item.matchEnded === true;
      const startRaw = str(item.startTimeUtc ?? item.startDateUtc);
      const startsAt = startRaw && !Number.isNaN(Date.parse(startRaw))
        ? new Date(startRaw).toISOString()
        : null;

      const matchType = str(item.type) || str(item.format);

      return {
        id,
        title: str(item.name) || `${teams[0]?.short ?? "?"} vs ${teams[1]?.short ?? "?"}`,
        matchType,
        venue: str(item.venue),
        teams,
        status: first(item.status) || first(item.statusText),
        live: started && !finished,
        started,
        finished,
        startsAt,
        international: INTERNATIONAL_TYPES.includes(matchType),
      };
    })
    .filter((match): match is LiveMatch => match !== null);
}

/** Live right now, and internationals still to start, soonest first. */
export function splitFeed(matches: LiveMatch[], now = Date.now()) {
  const live = matches.filter((match) => match.live);
  const upcoming = matches
    .filter(
      (match) =>
        match.international &&
        !match.started &&
        !match.finished &&
        match.startsAt !== null &&
        Date.parse(match.startsAt) > now
    )
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  return { live, upcoming: upcoming.slice(0, 8) };
}

export const LIVE_DISABLED_FEED: LiveFeed = {
  enabled: false,
  error: null,
  live: [],
  upcoming: [],
  fetchedAt: new Date(0).toISOString(),
};

/** Server-only: the key never reaches the browser. */
export async function fetchLiveFeed(): Promise<LiveFeed> {
  const key = str(process.env.CRICAPI_KEY);
  const fetchedAt = new Date().toISOString();

  if (!key) {
    return { ...LIVE_DISABLED_FEED, fetchedAt };
  }

  try {
    const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(
      key
    )}&offset=0`;
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      return {
        enabled: true,
        error: `Live provider returned ${response.status}`,
        live: [],
        upcoming: [],
        fetchedAt,
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    // CricAPI answers 200 even for a rejected key, so the status field is the
    // only way to tell "bad key" apart from "nothing is playing".
    const status = str(payload.status);
    if (status && status !== "success" && status !== "true") {
      return {
        enabled: true,
        error: `Live provider rejected the key (${str(payload.reason) || status})`,
        live: [],
        upcoming: [],
        fetchedAt,
      };
    }

    const matches = normaliseCricApi(payload);
    const { live, upcoming } = splitFeed(matches);
    return { enabled: true, error: null, live, upcoming, fetchedAt };
  } catch {
    return {
      enabled: true,
      error: "Live provider unreachable",
      live: [],
      upcoming: [],
      fetchedAt,
    };
  }
}
