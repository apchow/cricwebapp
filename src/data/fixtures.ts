/**
 * International series the XI builder can be laid out for.
 *
 * This is app content, not a live schedule: edit the fixtures here and the
 * builder's match chips, venues and opponent follow automatically. Squad
 * availability comes from `public/data/players.json` by `country` code.
 */
export type CountryCode = "IND" | "NZ" | "AUS" | "ENG" | "SA" | "WI" | "PAK" | "SL" | "AFG";

export interface OdiFixture {
  no: number;
  venue: string;
  city: string;
  date: string;
}

export interface InternationalSeries {
  id: string;
  name: string;
  format: "ODI";
  teamA: CountryCode;
  teamB: CountryCode;
  teamAName: string;
  teamBName: string;
  fixtures: OdiFixture[];
}

export const SERIES: InternationalSeries[] = [
  {
    id: "ind-nz-odi",
    name: "India vs New Zealand",
    format: "ODI",
    teamA: "IND",
    teamB: "NZ",
    teamAName: "India",
    teamBName: "New Zealand",
    fixtures: [
      { no: 1, venue: "Wankhede Stadium", city: "Mumbai", date: "ODI 1" },
      { no: 2, venue: "Dr. Y.S. Rajasekhara Reddy Stadium", city: "Visakhapatnam", date: "ODI 2" },
      { no: 3, venue: "M Chinnaswamy Stadium", city: "Bengaluru", date: "ODI 3" },
    ],
  },
];

export const DEFAULT_SERIES_ID = SERIES[0].id;

export function seriesById(id: string): InternationalSeries {
  return SERIES.find((series) => series.id === id) ?? SERIES[0];
}

/** ODI selection rules: eleven, a keeper, and five bowling options. */
export const ODI_RULES = {
  size: 11,
  minKeeper: 1,
  minBowlingOptions: 5,
  maxBowlingOptions: 7,
} as const;

export function otherSide(series: InternationalSeries, side: CountryCode): CountryCode {
  return side === series.teamA ? series.teamB : series.teamA;
}

export function sideName(series: InternationalSeries, side: CountryCode): string {
  return side === series.teamA ? series.teamAName : series.teamBName;
}
