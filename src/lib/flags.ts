const FLAGS: Record<string, string> = {
  IND: "🇮🇳",
  AUS: "🇦🇺",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  NZ: "🇳🇿",
  SA: "🇿🇦",
  WI: "🌴",
  SL: "🇱🇰",
  PAK: "🇵🇰",
  AFG: "🇦🇫",
  BAN: "🇧🇩",
  ZIM: "🇿🇼",
  IRE: "🇮🇪",
  NED: "🇳🇱",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  NAM: "🇳🇦",
  OMA: "🇴🇲",
  UAE: "🇦🇪",
  NEP: "🇳🇵",
};

export function flagOf(country: string): string {
  return FLAGS[country] ?? "🏳️";
}
