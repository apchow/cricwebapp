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

const IND_1_3: Squad = {
  captain: "Shubman Gill",
  viceCaptain: "Shreyas Iyer",
  keepers: ["Ishan Kishan", "KL Rahul", "Kumar Kushagra"],
  players: [
    "Shubman Gill",
    "Shreyas Iyer",
    "Rohit Sharma",
    "Virat Kohli",
    "Ruturaj Gaikwad",
    "Tilak Varma",
    "Nitish Kumar Reddy",
    "Ishan Kishan",
    "KL Rahul",
    "Kumar Kushagra",
    "Naman Dhir",
    "Anshul Kamboj",
    "Kuldeep Yadav",
    "Arshdeep Singh",
    "Mohammed Siraj",
    "Prasidh Krishna",
    "Yash Thakur",
    "Gurnoor Brar",
  ],
};

const IND_4_5: Squad = {
  captain: "Shubman Gill",
  viceCaptain: "Shreyas Iyer",
  keepers: ["Ishan Kishan", "KL Rahul", "Kumar Kushagra"],
  players: [
    "Shubman Gill",
    "Shreyas Iyer",
    "Rohit Sharma",
    "Virat Kohli",
    "Ruturaj Gaikwad",
    "Tilak Varma",
    "Nitish Kumar Reddy",
    "Ishan Kishan",
    "KL Rahul",
    "Kumar Kushagra",
    "Naman Dhir",
    "Axar Patel",
    "Kuldeep Yadav",
    "Arshdeep Singh",
    "Mohammed Siraj",
    "Yash Thakur",
    "Gurnoor Brar",
    "Auqab Nabi",
  ],
};

const NZ_SQUAD: Squad = {
  captain: "Mitchell Santner",
  viceCaptain: "Michael Bracewell",
  keepers: ["Devon Conway", "Tim Seifert"],
  players: [
    "Mitchell Santner",
    "Finn Allen",
    "Devon Conway",
    "Mark Chapman",
    "Daryl Mitchell",
    "Glenn Phillips",
    "Michael Bracewell",
    "Josh Clarkson",
    "Bevon Jacobs",
    "Tim Seifert",
    "Matt Henry",
    "Kyle Jamieson",
    "Jacob Duffy",
    "Lockie Ferguson",
    "Adam Milne",
    "Matthew Fisher",
    "Zak Foulkes",
    "Nathan Smith",
    "Blair Tickner",
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
      { label: "ODIs 1-3", fixtures: [1, 2, 3], IND: IND_1_3, NZ: NZ_SQUAD },
      { label: "ODIs 4-5", fixtures: [4, 5], IND: IND_4_5, NZ: NZ_SQUAD },
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
