/**
 * India's tour of New Zealand, 2026-27 — five ODIs, all played in New Zealand.
 *
 * Fixtures, dates, venues and squads follow the published tour schedule. Both
 * boards named a split squad: one for ODIs 1-3 and another for ODIs 4-5, so the
 * XI builder's pool changes with the match you pick.
 *
 * Squad lists are names; roles, form and prices come from
 * `public/data/players.json`. A name with no database row is reported in the
 * builder rather than silently dropped.
 */
export type CountryCode = "IND" | "NZ";

export interface OdiFixture {
  no: number;
  day: string;
  venue: string;
  city: string;
}

export interface Squad {
  captain: string;
  viceCaptain: string | null;
  keepers: string[];
  players: string[];
}

export interface SquadWindow {
  label: string;
  fixtures: number[];
  IND: Squad;
  NZ: Squad;
}

export interface InternationalSeries {
  id: string;
  name: string;
  format: "ODI";
  host: CountryCode;
  teamA: CountryCode;
  teamB: CountryCode;
  teamAName: string;
  teamBName: string;
  fixtures: OdiFixture[];
  windows: SquadWindow[];
}

/**
 * BCCI and NZC announced two groups each on 16 Oct / 10-11 Oct 2026; these lists
 * also carry every withdrawal and replacement since, so a player out of the series
 * never appears in a pool the user can pick.
 */
const IND_1_3: Squad = {
  captain: "Shubman Gill",
  viceCaptain: "Shreyas Iyer",
  keepers: ["KL Rahul", "Ishan Kishan"],
  players: [
    "Shubman Gill",
    "Rohit Sharma",
    "Virat Kohli",
    "Shreyas Iyer",
    "KL Rahul",
    "Ishan Kishan",
    "Ruturaj Gaikwad",
    "Nitish Kumar Reddy",
    "Axar Patel",
    "Naman Dhir",
    "Anshul Kamboj",
    "Gurnoor Brar",
    "Auqib Nabi",
    "Kuldeep Yadav",
    "Arshdeep Singh",
    "Mohammed Siraj",
  ],
};

const IND_4_5: Squad = {
  captain: "Shreyas Iyer",
  viceCaptain: "Ishan Kishan",
  keepers: ["Ishan Kishan", "Kumar Kushagra"],
  players: [
    "Shreyas Iyer",
    "Rohit Sharma",
    "Virat Kohli",
    "Ishan Kishan",
    "Tilak Varma",
    "Ruturaj Gaikwad",
    "Nitish Kumar Reddy",
    "Axar Patel",
    "Naman Dhir",
    "Gurnoor Brar",
    "Auqib Nabi",
    "Kumar Kushagra",
    "Kuldeep Yadav",
    "Arshdeep Singh",
    "Mohammed Siraj",
    "Yash Thakur",
  ],
};

const NZ_1_3: Squad = {
  captain: "Mitchell Santner",
  viceCaptain: null,
  keepers: ["Tom Latham", "Tim Seifert"],
  players: [
    "Mitchell Santner",
    "Michael Bracewell",
    "Tom Latham",
    "Tim Seifert",
    "Will Young",
    "Daryl Mitchell",
    "Glenn Phillips",
    "Henry Nicholls",
    "Dean Foxcroft",
    "Nick Kelly",
    "Matt Henry",
    "Kyle Jamieson",
    "Jacob Duffy",
    "Nathan Smith",
    "Kristian Clarke",
  ],
};

const NZ_4_5: Squad = {
  captain: "Mitchell Santner",
  viceCaptain: null,
  keepers: ["Tim Seifert", "Mitch Hay"],
  players: [
    "Mitchell Santner",
    "Finn Allen",
    "Michael Bracewell",
    "Mark Chapman",
    "Tim Seifert",
    "Mitch Hay",
    "Will Young",
    "Nick Kelly",
    "Matt Henry",
    "Jacob Duffy",
    "Matthew Fisher",
    "Kristian Clarke",
  ],
};

export const SERIES: InternationalSeries[] = [
  {
    id: "nz-ind-odi-2026",
    name: "India tour of New Zealand 2026-27",
    format: "ODI",
    host: "NZ",
    teamA: "IND",
    teamB: "NZ",
    teamAName: "India",
    teamBName: "New Zealand",
    fixtures: [
      { no: 1, day: "4 Nov 2026", venue: "Eden Park", city: "Auckland" },
      { no: 2, day: "7 Nov 2026", venue: "Wellington Regional Stadium", city: "Wellington" },
      { no: 3, day: "10 Nov 2026", venue: "Seddon Park", city: "Hamilton" },
      { no: 4, day: "13 Nov 2026", venue: "Bay Oval", city: "Tauranga" },
      { no: 5, day: "15 Nov 2026", venue: "Bay Oval", city: "Tauranga" },
    ],
    windows: [
      { label: "ODIs 1-3", fixtures: [1, 2, 3], IND: IND_1_3, NZ: NZ_1_3 },
      { label: "ODIs 4-5", fixtures: [4, 5], IND: IND_4_5, NZ: NZ_4_5 },
    ],
  },
];

export const DEFAULT_SERIES_ID = SERIES[0].id;

export function seriesById(id: string): InternationalSeries {
  return SERIES.find((series) => series.id === id) ?? SERIES[0];
}

export function otherSide(series: InternationalSeries, side: CountryCode): CountryCode {
  return side === series.teamA ? series.teamB : series.teamA;
}

export function sideName(series: InternationalSeries, side: CountryCode): string {
  return side === series.teamA ? series.teamAName : series.teamBName;
}

export function windowFor(series: InternationalSeries, fixtureNo: number): SquadWindow {
  return (
    series.windows.find((window) => window.fixtures.includes(fixtureNo)) ??
    series.windows[0]
  );
}

export function squadFor(
  series: InternationalSeries,
  side: CountryCode,
  fixtureNo: number
): Squad {
  return windowFor(series, fixtureNo)[side];
}

/** ODI selection rules: eleven, a keeper, and five to seven bowling options. */
export const ODI_RULES = {
  size: 11,
  minKeeper: 1,
  minBowlingOptions: 5,
  maxBowlingOptions: 7,
} as const;
