/**
 * Cricsheet → Pavilion XI stats snapshot.
 *
 * Usage:
 *   node scripts/ingest/cricsheet.mjs                    # uses data/raw/all_json.zip
 *   node scripts/ingest/cricsheet.mjs path/to/ipl_json.zip
 *
 * Outputs:
 *   data/stats/player-index.json   (lite, for directory/search)
 *   data/stats/players.json        (full career + format + IPL stats)
 *   data/stats/ipl-squads.json     (latest IPL season squad pool)
 *   data/stats/competitions.json
 *   data/stats/meta.json
 *
 * Data: Cricsheet (ODC-By 1.0). Attribution is rendered in the app.
 */
import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ZIP = process.argv[2] || path.join(ROOT, "data/raw/all_json.zip");
const OUT = path.join(ROOT, "data/stats");
const REGISTER = path.join(ROOT, "data/raw");

if (!fs.existsSync(ZIP)) {
  console.error(`Missing zip: ${ZIP}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ */
/* Registers                                                          */
/* ------------------------------------------------------------------ */

function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      // Registers have no quoted commas for player names; keep it simple and safe.
      const first = line.indexOf(",");
      if (first === -1) return [line];
      return [line.slice(0, first), ...line.slice(first + 1).split(",")];
    });
}

const aliases = new Map(); // id -> Set(names)
for (const [id, name] of readCsv(path.join(REGISTER, "names.csv"))) {
  if (!id || !name) continue;
  if (!aliases.has(id)) aliases.set(id, new Set());
  aliases.get(id).add(name.trim());
}

const registerNames = new Map(); // id -> { name, uniqueName }
for (const row of readCsv(path.join(REGISTER, "people.csv"))) {
  const [id, name, uniqueName] = row;
  if (!id) continue;
  registerNames.set(id, { name: (name || "").trim(), uniqueName: (uniqueName || "").trim() });
}

function displayName(id, fallback) {
  const candidates = new Set();
  const reg = registerNames.get(id);
  if (reg?.name) candidates.add(reg.name);
  if (reg?.uniqueName && !/\(\d+\)$/.test(reg.uniqueName)) candidates.add(reg.uniqueName);
  for (const a of aliases.get(id) ?? []) {
    if (!/\(\d+\)$/.test(a)) candidates.add(a);
  }
  if (fallback) candidates.add(fallback);
  // The richest variant is usually the full name (Virat Kohli > V Kohli).
  return [...candidates].sort((a, b) => b.length - a.length || a.localeCompare(b))[0] || fallback || id;
}

/* ------------------------------------------------------------------ */
/* Team metadata                                                      */
/* ------------------------------------------------------------------ */

const IPL_TEAMS = [
  { id: "csk", match: /Chennai Super Kings/i, name: "Chennai Super Kings", short: "CSK", color: "#facc15", ink: "#111827" },
  { id: "mi", match: /Mumbai Indians/i, name: "Mumbai Indians", short: "MI", color: "#38bdf8", ink: "#082f49" },
  { id: "rcb", match: /Royal Challengers (Bengaluru|Bangalore)/i, name: "Royal Challengers Bengaluru", short: "RCB", color: "#ef4444", ink: "#450a0a" },
  { id: "srh", match: /Sunrisers Hyderabad/i, name: "Sunrisers Hyderabad", short: "SRH", color: "#fb923c", ink: "#431407" },
  { id: "rr", match: /Rajasthan Royals/i, name: "Rajasthan Royals", short: "RR", color: "#f472b6", ink: "#500724" },
  { id: "kkr", match: /Kolkata Knight Riders/i, name: "Kolkata Knight Riders", short: "KKR", color: "#a78bfa", ink: "#2e1065" },
  { id: "gt", match: /Gujarat Titans/i, name: "Gujarat Titans", short: "GT", color: "#2dd4bf", ink: "#042f2e" },
  { id: "dc", match: /Delhi (Capitals|Daredevils)/i, name: "Delhi Capitals", short: "DC", color: "#60a5fa", ink: "#172554" },
  { id: "pbks", match: /Punjab Kings/i, name: "Punjab Kings", short: "PBKS", color: "#f87171", ink: "#450a0a" },
  { id: "lsg", match: /Lucknow Super Giants/i, name: "Lucknow Super Giants", short: "LSG", color: "#22d3ee", ink: "#083344" },
];

function teamMeta(name) {
  return IPL_TEAMS.find((t) => t.match.test(name));
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                        */
/* ------------------------------------------------------------------ */

const FORMAT_MAP = {
  Test: "TEST",
  MDM: "TEST",
  ODI: "ODI",
  ODM: "ODI",
  T20: "T20",
  IT20: "T20",
};

const PHASES = ["pp", "middle", "death"];

const TOP_TIER = /Indian Premier League|Big Bash|Pakistan Super League|SA20|International League T20|Caribbean Premier League|Major League Cricket|The Hundred|Lanka Premier League|Bangladesh Premier League|Super Smash|Vitality Blast|T20 Blast|Women's Premier League|Champions Trophy|Asia Cup|ICC Men's Cricket World Cup|ICC Women's Cricket World Cup|ICC Men's T20 World Cup|ICC Women's T20 World Cup/i;

function isTopTierCompetition(name) {
  if (!name) return false;
  if (/Sub Regional|Qualifier|Challenge|Division|Emerging/i.test(name)) return false;
  return TOP_TIER.test(name);
}

const FULL_MEMBERS = new Set([
  "India",
  "Australia",
  "England",
  "Pakistan",
  "South Africa",
  "New Zealand",
  "Sri Lanka",
  "West Indies",
  "Bangladesh",
  "Afghanistan",
  "Zimbabwe",
  "Ireland",
]);

// Cricsheet withholds Afghanistan matches; these IPL players need a manual country.
const COUNTRY_OVERRIDES = {
  "Rashid Khan": "Afghanistan",
  "Rahmanullah Gurbaz": "Afghanistan",
  "Noor Ahmad": "Afghanistan",
  "Mujeeb Ur Rahman": "Afghanistan",
  "Naveen-ul-Haq": "Afghanistan",
  "Azmatullah Omarzai": "Afghanistan",
  "Ibrahim Zadran": "Afghanistan",
  "Gulbadin Naib": "Afghanistan",
  "Karim Janat": "Afghanistan",
  "Mohammad Nabi": "Afghanistan",
  "Fazalhaq Farooqi": "Afghanistan",
  "Nangeyalia Kharote": "Afghanistan",
  "Sediqullah Atal": "Afghanistan",
  "Darwish Rasooli": "Afghanistan",
  "Zia Ur Rahman": "Afghanistan",
  "Qais Ahmad": "Afghanistan",
  "Wafadar Momand": "Afghanistan",
  "Bilal Sami": "Afghanistan",
};

const NON_NATIONAL = /^(ICC World XI|Asia XI|Africa XI|World XI|Global XI|ICC Combined XI)$/i;

const WK_OVERRIDES = new Set([
  "Phil Salt",
  "Philip Salt",
  "Sanju Samson",
  "Rishabh Pant",
  "KL Rahul",
  "K L Rahul",
  "Jos Buttler",
  "JC Buttler",
  "Quinton de Kock",
  "Q de Kock",
  "Heinrich Klaasen",
  "Nicholas Pooran",
  "Ishan Kishan",
  "Dhruv Jurel",
  "Dhruv Chand Jurel",
  "Jitesh Sharma",
  "Ryan Rickelton",
  "Tristan Stubbs",
  "Donovan Ferreira",
  "Josh Inglis",
  "Glenn Phillips",
  "Kusal Mendis",
  "Tim Seifert",
  "TL Seifert",
  "Abishek Porel",
  "Urvil Patel",
  "Vishnu Vinod",
  "Prabhsimran Singh",
  "Shreevats Goswami",
  "Anuj Rawat",
  "KS Bharat",
  "K S Bharat",
]);

function blank() {
  return {
    matches: 0,
    innings: 0,
    runs: 0,
    balls: 0,
    dismissals: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    ballsBowled: 0,
    runsConceded: 0,
    dotBalls: 0,
    catches: 0,
    stumpings: 0,
    runouts: 0,
  };
}

function blankPhases() {
  return {
    pp: { runs: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0 },
    middle: { runs: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0 },
    death: { runs: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0 },
  };
}

function blankPlayer(id, name) {
  return {
    id,
    name,
    teams: new Set(),
    nationalTeams: new Set(),
    nationalTeamStats: new Map(),
    competitions: new Map(),
    topTierMatches: 0,
    topTierBalls: 0,
    topTierBallsBowled: 0,
    formats: { T20: blank(), ODI: blank(), TEST: blank() },
    ipl: blank(),
    overall: blank(),
    phases: blankPhases(),
    firstPlayed: null,
    lastPlayed: null,
    gender: null,
  };
}

const players = new Map();
const competitions = new Map();
const iplSeasons = new Map(); // season -> team -> Set(playerId)
let matchCount = 0;

function getPlayer(id, fallbackName) {
  if (!players.has(id)) players.set(id, blankPlayer(id, fallbackName || id));
  const p = players.get(id);
  if (fallbackName && (!p.name || p.name === id)) p.name = fallbackName;
  return p;
}

function bump(stats, key, value = 1) {
  stats[key] = (stats[key] || 0) + value;
}

function addFormat(p, fmt) {
  return p.formats[fmt] ?? (p.formats[fmt] = blank());
}

function addMatch(p, fmt, isIpl, team, competition, date, gender, isInternational, topTier) {
  bump(p.overall, "matches");
  bump(addFormat(p, fmt), "matches");
  if (isIpl) bump(p.ipl, "matches");
  p.teams.add(team);
  p.competitions.set(competition, (p.competitions.get(competition) || 0) + 1);
  p.gender = p.gender ?? gender;
  if (isInternational) {
    const nt = p.nationalTeamStats.get(team) || { matches: 0, last: "" };
    nt.matches += 1;
    if (date > nt.last) nt.last = date;
    p.nationalTeamStats.set(team, nt);
  }
  if (topTier) p.topTierMatches += 1;
  if (!p.firstPlayed || date < p.firstPlayed) p.firstPlayed = date;
  if (!p.lastPlayed || date > p.lastPlayed) p.lastPlayed = date;
}

const zip = new AdmZip(ZIP);
const entries = zip.getEntries().filter((e) => e.entryName.endsWith(".json"));

console.log(`Reading ${entries.length} match files from ${path.basename(ZIP)}…`);

for (const [i, entry] of entries.entries()) {
  let d;
  try {
    d = JSON.parse(entry.getData().toString("utf8"));
  } catch {
    continue;
  }
  const info = d.info;
  if (!info?.teams || !info?.players || !d.innings) continue;

  matchCount += 1;
  const fmt = FORMAT_MAP[info.match_type] || "T20";
  const isIpl = /Indian Premier League/i.test(info.event?.name || "");
  const competition = info.event?.name || info.match_type || "Unknown";
  const season = String(info.season || (info.dates?.[0] || "").slice(0, 4));
  const date = info.dates?.[0] || "";
  const gender = info.gender || "unknown";

  if (!competitions.has(competition)) {
    competitions.set(competition, {
      name: competition,
      matches: 0,
      formats: new Set(),
      genders: new Set(),
      first: date,
      last: date,
      ipl: isIpl,
    });
  }
  const comp = competitions.get(competition);
  comp.matches += 1;
  comp.formats.add(fmt);
  comp.genders.add(gender);
  if (date && (!comp.first || date < comp.first)) comp.first = date;
  if (date && (!comp.last || date > comp.last)) comp.last = date;

  const registry = info.registry?.people || {};
  const idFor = (name) => registry[name] || `name:${name}`;
  const isInternational = info.team_type === "international";
  const topTier =
    isTopTierCompetition(competition) ||
    (isInternational && info.teams.every((team) => FULL_MEMBERS.has(team)));

  // Matchday squads (Cricsheet lists the XI + impact player for IPL).
  const seenThisMatch = new Set();
  for (const team of info.teams) {
    const list = info.players[team] || [];
    for (const name of list) {
      const id = idFor(name);
      if (seenThisMatch.has(id)) continue;
      seenThisMatch.add(id);
      const p = getPlayer(id, name);
      addMatch(p, fmt, isIpl, team, competition, date, gender, isInternational, topTier);
      if (isInternational) p.nationalTeams.add(team);
      if (isIpl) {
        if (!iplSeasons.has(season)) iplSeasons.set(season, new Map());
        const seasonTeams = iplSeasons.get(season);
        if (!seasonTeams.has(team)) seasonTeams.set(team, new Map());
        const playerMatches = seasonTeams.get(team);
        playerMatches.set(id, (playerMatches.get(id) || 0) + 1);
      }
    }
  }

  for (const innings of d.innings) {
    const batted = new Set();
    for (const over of innings.overs || []) {
      const overNo = Number(over.over ?? 0);
      const phase = overNo < 6 ? "pp" : overNo < 15 ? "middle" : "death";
      for (const ball of over.deliveries || []) {
        const batter = getPlayer(idFor(ball.batter), ball.batter);
        const bowler = getPlayer(idFor(ball.bowler), ball.bowler);
        const nonStriker = ball.non_striker ? getPlayer(idFor(ball.non_striker), ball.non_striker) : null;
        const runs = ball.runs || {};
        const extra = ball.extras || {};
        const isWide = Boolean(extra.wides);
        const isNoBall = Boolean(extra.noballs);
        const batterRuns = Number(runs.batter || 0);
        const totalRuns = Number(runs.total || 0);
        const batStats = [batter.overall, addFormat(batter, fmt)];
        const bowlStats = [bowler.overall, addFormat(bowler, fmt)];

        batted.add(batter.id);
        if (nonStriker) batted.add(nonStriker.id);

        if (!isWide) {
          for (const s of batStats) bump(s, "balls");
          if (isIpl) bump(batter.ipl, "balls");
          if (topTier) bump(batter, "topTierBalls");
          if (fmt === "T20") {
            bump(batter.phases[phase], "balls");
            bump(batter.phases[phase], "runs", batterRuns);
          }
        }
        for (const s of batStats) bump(s, "runs", batterRuns);
        if (isIpl) bump(batter.ipl, "runs", batterRuns);

        if (batterRuns === 4) {
          for (const s of batStats) bump(s, "fours");
          if (isIpl) bump(batter.ipl, "fours");
        }
        if (batterRuns === 6) {
          for (const s of batStats) bump(s, "sixes");
          if (isIpl) bump(batter.ipl, "sixes");
        }

        if (!isWide && !isNoBall) {
          const conceded = batterRuns + Number(extra.wides || 0) + Number(extra.noballs || 0);
          for (const s of bowlStats) {
            bump(s, "ballsBowled");
            bump(s, "runsConceded", conceded);
            if (totalRuns === 0) bump(s, "dotBalls");
          }
          if (isIpl) {
            bump(bowler.ipl, "ballsBowled");
            bump(bowler.ipl, "runsConceded", conceded);
            if (totalRuns === 0) bump(bowler.ipl, "dotBalls");
          }
          if (topTier) bump(bowler, "topTierBallsBowled");
          if (fmt === "T20") {
            bump(bowler.phases[phase], "ballsBowled");
            bump(bowler.phases[phase], "runsConceded", conceded);
          }
        }

        for (const wicket of ball.wickets || []) {
          const out = getPlayer(idFor(wicket.player_out), wicket.player_out);
          for (const s of [out.overall, addFormat(out, fmt)]) bump(s, "dismissals");
          if (isIpl) bump(out.ipl, "dismissals");

          const kind = String(wicket.kind || "");
          const notBowler = ["run out", "retired hurt", "retired out", "obstructing the field", "handled the ball", "hit the ball twice"];
          if (!notBowler.includes(kind)) {
            for (const s of bowlStats) bump(s, "wickets");
            if (isIpl) bump(bowler.ipl, "wickets");
            if (fmt === "T20") bump(bowler.phases[phase], "wickets");
          }

          const fielders = wicket.fielders || [];
          for (const f of fielders) {
            if (!f?.name) continue;
            const fp = getPlayer(idFor(f.name), f.name);
            if (kind === "caught" || kind === "caught and bowled") {
              for (const s of [fp.overall, addFormat(fp, fmt)]) bump(s, "catches");
              if (isIpl) bump(fp.ipl, "catches");
            } else if (kind === "stumped") {
              for (const s of [fp.overall, addFormat(fp, fmt)]) bump(s, "stumpings");
              if (isIpl) bump(fp.ipl, "stumpings");
            } else if (kind === "run out") {
              for (const s of [fp.overall, addFormat(fp, fmt)]) bump(s, "runouts");
              if (isIpl) bump(fp.ipl, "runouts");
            }
          }
        }
      }
    }
    // Batting innings: faced at least one ball (or was dismissed).
    for (const id of batted) {
      const p = players.get(id);
      if (!p) continue;
      bump(p.overall, "innings");
      bump(addFormat(p, fmt), "innings");
      if (isIpl) bump(p.ipl, "innings");
    }
  }

  if ((i + 1) % 2000 === 0) console.log(`  ${i + 1}/${entries.length} matches…`);
}

/* ------------------------------------------------------------------ */
/* Derive fields + impact                                             */
/* ------------------------------------------------------------------ */

function rate(num, den, mult = 1) {
  return den ? (num / den) * mult : 0;
}

function pct(sorted, value) {
  if (!sorted.length) return 0.5;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

for (const p of players.values()) {
  p.displayName = displayName(p.id, p.name);
  const national = [...p.nationalTeamStats.entries()]
    .filter(([team]) => !NON_NATIONAL.test(team))
    .sort((a, b) => (b[1].last || "").localeCompare(a[1].last || "") || b[1].matches - a[1].matches);
  p.country = COUNTRY_OVERRIDES[p.displayName] || national[0]?.[0] || (p.competitions.size ? "India" : "Unknown");
  p.overseas = p.country !== "India" && p.country !== "Unknown";
  p.uncapped = !p.overseas && national.length === 0;

  const t20 = p.formats.T20;
  const balls = t20.balls || p.overall.balls;
  const runs = t20.runs || p.overall.runs;
  const wickets = t20.wickets || p.overall.wickets;
  const ballsBowled = t20.ballsBowled || p.overall.ballsBowled;
  const runsConceded = t20.runsConceded || p.overall.runsConceded;

  p.t20 = {
    ...t20,
    strikeRate: rate(t20.runs, t20.balls, 100),
    average: t20.dismissals ? t20.runs / t20.dismissals : null,
    economy: rate(t20.runsConceded, t20.ballsBowled, 6),
    bowlingAverage: t20.wickets ? t20.runsConceded / t20.wickets : null,
    bowlingStrikeRate: t20.wickets ? t20.ballsBowled / t20.wickets : null,
    boundaryPct: rate(t20.fours * 4 + t20.sixes * 6, t20.balls, 100),
    dotPct: rate(t20.dotBalls, t20.balls, 100),
  };

  p.iplStats = {
    ...p.ipl,
    strikeRate: rate(p.ipl.runs, p.ipl.balls, 100),
    average: p.ipl.dismissals ? p.ipl.runs / p.ipl.dismissals : null,
    economy: rate(p.ipl.runsConceded, p.ipl.ballsBowled, 6),
    bowlingAverage: p.ipl.wickets ? p.ipl.runsConceded / p.ipl.wickets : null,
    boundaryPct: rate(p.ipl.fours * 4 + p.ipl.sixes * 6, p.ipl.balls, 100),
  };

  // Role heuristic (T20 first: Test batting/bowling volume distorts roles).
  const roleT20 = p.formats.T20;
  const roleBalls = roleT20.balls || p.overall.balls;
  const roleBallsBowled = roleT20.ballsBowled || p.overall.ballsBowled;
  const stumpings = p.overall.stumpings;
  const bowlShare = roleBallsBowled / Math.max(1, roleBalls + roleBallsBowled);
  if (WK_OVERRIDES.has(p.displayName) || stumpings >= 3) p.role = "WK";
  else if (roleBallsBowled >= 300 && roleBalls >= 300 && bowlShare >= 0.2) p.role = "AR";
  else if (roleBallsBowled > roleBalls) p.role = "BOWL";
  else p.role = "BAT";

  p.competitionList = [...p.competitions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, matches]) => ({ name, matches }));

  p.teams = [...p.teams];
  p.nationalTeams = national.map(([team]) => team);
  if (COUNTRY_OVERRIDES[p.displayName]) p.nationalTeams = [COUNTRY_OVERRIDES[p.displayName]];
  p.countryConfidence = p.nationalTeams.length ? "international" : "inferred";
}

/* Impact percentiles per role cohort, using T20 (fallback overall). */
const cohorts = new Map();
for (const p of players.values()) {
  if ((p.t20.matches || p.overall.matches) < 2) continue;
  const role = p.role;
  if (!cohorts.has(role)) cohorts.set(role, []);
  cohorts.get(role).push(p);
}

const sorted = {};
for (const [role, list] of cohorts) {
  sorted[role] = {
    sr: list.map((p) => p.t20.strikeRate).sort((a, b) => a - b),
    avg: list.map((p) => p.t20.average ?? 0).sort((a, b) => a - b),
    runsInns: list.map((p) => rate(p.t20.runs, Math.max(1, p.t20.innings))).sort((a, b) => a - b),
    boundary: list.map((p) => p.t20.boundaryPct).sort((a, b) => a - b),
    econ: list.map((p) => p.t20.economy || 99).sort((a, b) => a - b),
    wktRate: list.map((p) => rate(p.t20.wickets, Math.max(1, p.t20.ballsBowled))).sort((a, b) => a - b),
    bowlAvg: list.map((p) => p.t20.bowlingAverage ?? 99).sort((a, b) => a - b),
    dot: list.map((p) => p.t20.dotPct).sort((a, b) => a - b),
    field: list.map((p) => rate(p.t20.catches + p.t20.stumpings + p.t20.runouts, Math.max(1, p.t20.matches))).sort((a, b) => a - b),
  };
}

for (const p of players.values()) {
  const cohort = sorted[p.role] || sorted.BAT || { sr: [], avg: [], runsInns: [], boundary: [], econ: [], wktRate: [], bowlAvg: [], dot: [], field: [] };
  const t = p.t20;
  const bat =
    0.45 * pct(cohort.sr, t.strikeRate) +
    0.25 * pct(cohort.boundary, t.boundaryPct) +
    0.2 * pct(cohort.avg, t.average ?? 0) +
    0.1 * pct(cohort.runsInns, rate(t.runs, Math.max(1, t.innings)));
  const bowl =
    0.4 * (1 - pct(cohort.econ, t.economy || 99)) +
    0.3 * pct(cohort.wktRate, rate(t.wickets, Math.max(1, t.ballsBowled))) +
    0.2 * (1 - pct(cohort.bowlAvg, t.bowlingAverage ?? 99)) +
    0.1 * pct(cohort.dot, t.dotPct);
  const field = pct(cohort.field, rate(t.catches + t.stumpings + t.runouts, Math.max(1, t.matches)));

  let raw;
  if (p.role === "BOWL") raw = 0.85 * bowl + 0.1 * field + 0.05 * bat;
  else if (p.role === "AR") raw = 0.45 * bat + 0.45 * bowl + 0.1 * field;
  else if (p.role === "WK") raw = 0.7 * bat + 0.2 * field + 0.1 * bowl;
  else raw = 0.85 * bat + 0.1 * field + 0.05 * bowl;

  const sample = Math.max(t.balls, t.ballsBowled);
  const topSample = Math.max(p.topTierBalls, p.topTierBallsBowled);
  const trust = Math.min(1, topSample / 450);
  const year = p.lastPlayed ? Number(p.lastPlayed.slice(0, 4)) : 0;
  const recency = year >= 2024 ? 1 : year >= 2022 ? 0.85 : 0.65;
  const tier = p.topTierMatches >= 10 ? 1 : p.topTierMatches >= 3 ? 0.9 : 0.8;
  p.impact = Math.round((50 + (raw * 100 - 50) * trust * recency * tier) * 10) / 10;
  p.qualified = topSample >= 250 && year >= 2023 && sample >= 250;
  const roleBonus = p.role === "WK" ? 1 : p.role === "AR" ? 0.6 : p.role === "BOWL" ? 0.4 : 0;
  p.retentionValue = Math.round(Math.min(23, Math.max(4, 4 + (p.impact / 100) * 17 + roleBonus)) * 2) / 2;
}

/* ------------------------------------------------------------------ */
/* Output                                                             */
/* ------------------------------------------------------------------ */

function clean(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.displayName,
    shortName: p.name,
    role: p.role,
    country: p.country,
    overseas: p.overseas,
    uncapped: p.uncapped,
    countryConfidence: p.countryConfidence,
    gender: p.gender,
    teams: p.teams,
    nationalTeams: p.nationalTeams,
    competitions: p.competitionList,
    firstPlayed: p.firstPlayed,
    lastPlayed: p.lastPlayed,
    impact: p.impact,
    qualified: p.qualified,
    topTierMatches: p.topTierMatches,
    topTierBalls: p.topTierBalls,
    topTierBallsBowled: p.topTierBallsBowled,
    retentionValue: p.retentionValue,
    overall: p.overall,
    t20: p.t20,
    ipl: p.iplStats,
    formats: {
      T20: p.t20,
      ODI: {
        ...p.formats.ODI,
        strikeRate: rate(p.formats.ODI.runs, p.formats.ODI.balls, 100),
        average: p.formats.ODI.dismissals ? p.formats.ODI.runs / p.formats.ODI.dismissals : null,
        economy: rate(p.formats.ODI.runsConceded, p.formats.ODI.ballsBowled, 6),
        bowlingAverage: p.formats.ODI.wickets ? p.formats.ODI.runsConceded / p.formats.ODI.wickets : null,
      },
      TEST: {
        ...p.formats.TEST,
        strikeRate: rate(p.formats.TEST.runs, p.formats.TEST.balls, 100),
        average: p.formats.TEST.dismissals ? p.formats.TEST.runs / p.formats.TEST.dismissals : null,
        economy: rate(p.formats.TEST.runsConceded, p.formats.TEST.ballsBowled, 6),
        bowlingAverage: p.formats.TEST.wickets ? p.formats.TEST.runsConceded / p.formats.TEST.wickets : null,
      },
    },
    phases: p.phases,
  };
}

const all = [...players.values()].filter((p) => p.overall.matches > 0);

// Slugs (stable, collision-safe).
const slugCount = new Map();
for (const p of all.sort((a, b) => (Number(b.qualified) - Number(a.qualified)) || b.impact - a.impact)) {
  const base =
    p.displayName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "player";
  const n = (slugCount.get(base) || 0) + 1;
  slugCount.set(base, n);
  p.slug = n === 1 ? base : `${base}-${n}`;
}

const full = all.map(clean);
const index = full.map((p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  role: p.role,
  country: p.country,
  overseas: p.overseas,
  uncapped: p.uncapped,
  teams: p.teams.slice(0, 3),
  matches: p.overall.matches,
  runs: p.overall.runs,
  wickets: p.overall.wickets,
  strikeRate: p.t20.strikeRate,
  economy: p.t20.economy,
  impact: p.impact,
  qualified: p.qualified,
  retentionValue: p.retentionValue,
  iplMatches: p.ipl.matches,
  lastPlayed: p.lastPlayed,
}));

/* Latest IPL season → squad pool; top up with the previous season if thin. */
const seasons = [...iplSeasons.keys()]
  .filter((s) => /^\d{4}$/.test(s))
  .sort((a, b) => Number(b) - Number(a));
const latestSeason = seasons[0] || "2026";
const previousSeason = seasons[1];
const squadPool = new Map(); // team -> Map(playerId -> {lastSeason, matches, latestMatches})

const latestTeams = iplSeasons.get(latestSeason) || new Map();
for (const [team, playerMatches] of latestTeams) {
  const pool = new Map();
  for (const [id, count] of playerMatches) {
    pool.set(id, { lastSeason: latestSeason, matches: count, latestMatches: count });
  }
  squadPool.set(team, pool);
}

const previousTeams = previousSeason ? iplSeasons.get(previousSeason) || new Map() : new Map();
for (const [team, playerMatches] of previousTeams) {
  if (!squadPool.has(team)) continue; // don't resurrect a defunct franchise
  const pool = squadPool.get(team);
  const byImpact = [...playerMatches.entries()].sort((a, b) => {
    const pa = players.get(a[0]);
    const pb = players.get(b[0]);
    return (pb?.impact || 0) - (pa?.impact || 0);
  });
  for (const [id, count] of byImpact) {
    if (pool.size >= 20) break;
    if (pool.has(id)) {
      pool.get(id).matches += count;
      continue;
    }
    pool.set(id, { lastSeason: previousSeason, matches: count, latestMatches: 0 });
  }
}

const byId = new Map(full.map((p) => [p.id, p]));
const iplTeams = [];
for (const [teamName, pool] of squadPool) {
  const meta = teamMeta(teamName);
  if (!meta) continue;
  const squad = [...pool.entries()]
    .map(([id, e]) => {
      const p = byId.get(id);
      if (!p) return null;
      return {
        id,
        name: p.name,
        role: p.role,
        country: p.country,
        overseas: p.overseas,
        uncapped: p.uncapped,
        impact: p.impact,
        qualified: p.qualified,
        retentionValue: p.retentionValue,
        matches: p.ipl.matches,
        seasonMatches: e.matches,
        latestSeasonMatches: e.latestMatches,
        lastSeason: e.lastSeason,
        runs: p.ipl.runs,
        balls: p.ipl.balls,
        strikeRate: p.ipl.strikeRate,
        wickets: p.ipl.wickets,
        economy: p.ipl.economy,
        lastPlayed: p.lastPlayed,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.impact - a.impact);
  iplTeams.push({ ...meta, squad });
}
iplTeams.sort((a, b) => a.name.localeCompare(b.name));

const competitionList = [...competitions.values()]
  .map((c) => ({
    name: c.name,
    matches: c.matches,
    formats: [...c.formats],
    genders: [...c.genders],
    first: c.first,
    last: c.last,
    ipl: c.ipl,
  }))
  .sort((a, b) => b.matches - a.matches);

const meta = {
  generatedAt: new Date().toISOString(),
  source: "Cricsheet",
  sourceUrl: "https://cricsheet.org/",
  license: "ODC-By 1.0 (XML: CC BY 4.0)",
  matches: matchCount,
  players: full.length,
  competitions: competitionList.length,
  latestIplSeason: latestSeason,
  iplTeams: iplTeams.length,
  note: "IPL squad pools are derived from the latest Cricsheet season, topped up from the previous season where needed. They are not official 2027 squads.",
  qualifiedPlayers: full.filter((p) => p.qualified).length,
};

fs.writeFileSync(path.join(OUT, "players.json"), JSON.stringify(full));
fs.writeFileSync(path.join(OUT, "player-index.json"), JSON.stringify(index));
fs.writeFileSync(path.join(OUT, "ipl-squads.json"), JSON.stringify({ season: latestSeason, note: meta.note, teams: iplTeams }));
fs.writeFileSync(path.join(OUT, "competitions.json"), JSON.stringify(competitionList));
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));

console.log(
  `Done. ${matchCount} matches · ${full.length} players · ${competitionList.length} competitions · ${iplTeams.length} IPL teams`
);
console.log(`Wrote ${OUT}`);
