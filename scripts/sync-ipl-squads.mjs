/**
 * Rebuild the IPL squad data from Cricsheet's ball-by-ball files.
 *
 * Cricsheet's registry gives every player a stable id, and those ids are
 * already the `id` field in src/data/ipl-squads.json — so this joins on id and
 * never on spelling. Names are only rewritten when a database row maps to
 * exactly one pool entry and that entry is claimed by exactly one row, which is
 * what keeps "Rahul Chahar" from being renamed to Deepak Chahar's scorebook
 * form. Franchise affiliation comes from who actually played for whom.
 *
 * Ratings that Cricsheet cannot supply (form, ppImpact, deathImpact, vfm,
 * basePrice) are derived from real batting and bowling output by the bands in
 * `estimate` below. They remain estimates, not published ratings.
 *
 * Usage: node scripts/sync-ipl-squads.mjs <directory-of-cricsheet-json>
 *   Download: https://cricsheet.org/downloads/ipl_json.zip, unzip, point at it.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2];
if (!DIR || !fs.existsSync(DIR)) {
  console.error("usage: node scripts/sync-ipl-squads.mjs <dir of Cricsheet IPL json files>");
  process.exit(1);
}

const POOL_FILE = path.join(process.cwd(), "src", "data", "ipl-squads.json");
const DB_FILE = path.join(process.cwd(), "public", "data", "players.json");
const LATEST = "2026";

const TEAM_OF = {
  "Chennai Super Kings": "CSK", "Delhi Capitals": "DC", "Gujarat Titans": "GT",
  "Kolkata Knight Riders": "KKR", "Lucknow Super Giants": "LSG", "Mumbai Indians": "MI",
  "Punjab Kings": "PBKS", "Rajasthan Royals": "RR", "Royal Challengers Bengaluru": "RCB",
  "Royal Challengers Bangalore": "RCB", "Sunrisers Hyderabad": "SRH", "Kings XI Punjab": "PBKS",
};

/** Confirmed by iplt20.com press releases; nothing rumoured is applied. */
const TRADES = [
  { name: "Rishabh Pant", to: "DC", on: "23 Jun 2026" },
  { name: "Kuldeep Yadav", to: "LSG", on: "23 Jun 2026" },
  { name: "T Natarajan", to: "SRH", on: "14 Oct 2026" },
  { name: "Zeeshan Ansari", to: "DC", on: "14 Oct 2026" },
  { name: "Liam Livingstone", to: "CSK", on: "5 Nov 2026" },
  { name: "Jack Edwards", to: "CSK", on: "5 Nov 2026" },
  { name: "Khaleel Ahmed", to: "SRH", on: "5 Nov 2026" },
  { name: "Nathan Ellis", to: "SRH", on: "5 Nov 2026" },
];
const RETIRED = [{ name: "Ajinkya Rahane", on: "30 Jul 2026" }];

/**
 * Cricsheet prints these players as scorebook initials, and the franchise's own
 * squad page or Cricinfo's profile gives the name to show. Two of these are
 * traps: Rahul Desraj Chahar is "RD Chahar" (RPS/MI/PBKS/SRH/CSK) while his
 * cousin Deepak is "DL Chahar" (MI in 2026), and the LSG keeper is Mukul
 * Choudhary — "Mukesh Choudhary" is a different, real player.
 */
const DISPLAY = {
  "R D Chahar": "Rahul Chahar",
  "D L Chahar": "Deepak Chahar",
  "S N Khan": "Sarfaraz Khan",
  "M Shahrukh Khan": "Shahrukh Khan",
  "PR Veer": "Prashant Veer",
  "RS Ghosh": "Ramakrishna Ghosh",
  "SU Parakh": "Sahil Parakh",
  "MJ Suthar": "Manav Suthar",
  "N Sindhu": "Nishant Sindhu",
  "T Dahiya": "Tejasvi Dahiya",
  "MD Choudhary": "Mukul Choudhary",
  "MP Yadav": "Mayank Yadav",
  "M Siddharth": "Manimaran Siddharth",
  "RA Bawa": "Raj Bawa",
  "DV Malewar": "Danish Malewar",
  "C Connolly": "Cooper Connolly",
  "N Burger": "Nandre Burger",
  "SS Mishra": "Sushant Mishra",
  "PP Hinge": "Praful Hinge",
  "R Smaran": "Smaran Ravichandran",
  "DA Payne": "David Payne",
  // The CSK scorebook "J Overton" is Jamie Overton; Craig has no IPL deliveries.
  "J Overton": "Jamie Overton",
  "N Thushara": "Nuwan Thushara",
  "SR Dubey": "Saurabh Dubey",
  "K Nithish Kumar Reddy": "Nitish Kumar Reddy",
  "Thangarasu Natarajan": "T Natarajan",
  "E Malinga": "Eshan Malinga",
  "V Suryavanshi": "Vaibhav Suryavanshi",
  "YBK Jaiswal": "Yashasvi Jaiswal",
  "B Sai Sudharsan": "Sai Sudharsan",
  "MS Washington Sundar": "Washington Sundar",
  "M Prasidh Krishna": "Prasidh Krishna",
  "R K Tewatia": "Rahul Tewatia",
  "A Raghuvanshi": "Angkrish Raghuvanshi",
  "V Chakravarthy": "Varun Chakravarthy",
  "R Powell": "Rovman Powell",
  "K L Rahul": "KL Rahul",
};

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const toks = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").trim().split(/\s+/).filter(Boolean);

/**
 * Cricsheet JSON records a dismissal as a `wickets` array on the delivery, not
 * a `wicket` flag, and only some kinds count as a batter's out or a bowler's
 * wicket. Reading the wrong key silently zeroed every wicket total once.
 */
const NOT_AN_OUT = new Set(["retired hurt", "retired out", "absent hurt", "absent ill"]);
const NOT_A_BOWL_WICKET = new Set([
  ...NOT_AN_OUT,
  "run out",
  "obstructing the field",
  "timed out",
  "hit the ball twice",
  "retired",
]);
const outsOf = (delivery) => (delivery.wickets ?? []).filter((w) => !NOT_AN_OUT.has(w.kind)).length;
const wicketsOf = (delivery) => (delivery.wickets ?? []).filter((w) => !NOT_A_BOWL_WICKET.has(w.kind)).length;

/** "R D Gaikwad" and "Ruturaj Gaikwad" agree; "Musheer" and "Mohsin" do not. */
function samePlayer(a, b) {
  const A = toks(a), B = toks(b);
  if (A.at(-1) !== B.at(-1)) return false;
  const fa = A.slice(0, -1).filter((t) => t.length > 2), fb = B.slice(0, -1).filter((t) => t.length > 2);
  const ia = A.slice(0, -1).filter((t) => t.length <= 2), ib = B.slice(0, -1).filter((t) => t.length <= 2);
  if (fa.length && fb.length && !(fa.every((w) => fb.includes(w)) || fb.every((w) => fa.includes(w)))) return false;
  if (fa.length && !fb.length && !fa.every((w) => ib.some((i) => i[0] === w[0]))) return false;
  if (fb.length && !fa.length && !fb.every((w) => ia.some((i) => i[0] === w[0]))) return false;
  return true;
}

const blank = () => ({ matches: 0, runs: 0, balls: 0, outs: 0, bb: 0, rc: 0, wk: 0, last: "" });
const bump = (map, key) => {
  if (!map.has(key)) map.set(key, blank());
  return map.get(key);
};

const career = new Map();
const season = new Map();
const aliases = new Map();

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  } catch {
    continue;
  }
  const people = doc.info?.registry?.people ?? {};
  for (const [name, id] of Object.entries(people)) {
    if (!aliases.has(id)) aliases.set(id, new Set());
    aliases.get(id).add(name);
  }
  const date = doc.info?.dates?.[0];
  const year = (date ?? "").slice(0, 4);
  if (year < "2008" || year > LATEST) continue;

  const played = new Set();
  for (const [team, list] of Object.entries(doc.info?.players ?? {})) {
    const short = TEAM_OF[team];
    if (!short) continue;
    for (const name of list) {
      const id = people[name];
      if (id) played.add(`${id}|${short}`);
    }
  }
  for (const key of played) {
    const [id, short] = key.split("|");
    const c = bump(career, id);
    c.matches += 1;
    if (date > c.last) c.last = date;
    if (year === LATEST) {
      const s = bump(season, key);
      s.matches += 1;
      if (date > s.last) s.last = date;
    }
  }

  for (const innings of doc.innings ?? []) {
    const bat = TEAM_OF[innings.team];
    const bowl = doc.info?.teams?.map((t) => TEAM_OF[t]).find((t) => t && t !== bat);
    if (!bat) continue;
    for (const over of innings.overs ?? []) {
      for (const ball of over.deliveries ?? []) {
        const batter = people[ball.batter];
        if (batter) {
          for (const [map, key] of year === LATEST ? [[career, batter], [season, `${batter}|${bat}`]] : [[career, batter]]) {
            const r = bump(map, key);
            r.runs += ball.runs?.batter ?? 0;
            r.balls += 1;
            r.outs += outsOf(ball);
          }
        }
        const non = people[ball.non_striker];
        if (non) {
          bump(career, non);
          if (year === LATEST) bump(season, `${non}|${bat}`);
        }
        const bowler = people[ball.bowler];
        if (bowler && bowl) {
          for (const [map, key] of year === LATEST ? [[career, bowler], [season, `${bowler}|${bowl}`]] : [[career, bowler]]) {
            const r = bump(map, key);
            r.bb += 1;
            r.rc += ball.runs?.total ?? 0;
            r.wk += wicketsOf(ball);
          }
        }
      }
    }
  }
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));
const sr = (runs, balls) => (balls ? (runs / balls) * 100 : 0);
const econ = (rc, bb) => (bb ? (rc / bb) * 6 : null);

/**
 * form 52-95: a share of an elite season (450 runs or 18 wickets, a 40 career
 * average, 100 wickets, a 160 strike rate, a 6.0 economy), weighted by role, so
 * only a genuine all-season performer reaches the top band. The impact columns
 * lean on the tempo and tightness the numbers actually show.
 */
function estimate(player, c, s) {
  const seasonRuns = s?.runs ?? 0;
  const seasonBalls = s?.balls ?? 0;
  const seasonWk = s?.wk ?? 0;
  const bowlBalls = s?.bb ?? 0;
  const tempo = seasonBalls ? (seasonRuns / seasonBalls) * 100 : 0;
  const tight = bowlBalls ? (s.rc / bowlBalls) * 6 : null;
  const careerAvg = c?.outs ? c.runs / c.outs : (c?.runs ?? 0);
  const bat =
    0.45 * Math.min(1, seasonRuns / 450) +
    0.3 * Math.min(1, careerAvg / 40) +
    0.25 * Math.min(1, Math.max(tempo, c?.balls ? (c.runs / c.balls) * 100 : 0) / 160);
  const bowl =
    0.45 * Math.min(1, seasonWk / 18) +
    0.3 * Math.min(1, (c?.wk ?? 0) / 100) +
    0.25 * clamp(((tight ?? 9.5) <= 0 ? 1 : (9.5 - tight) / 3.5), 0, 1);
  const weight =
    player.role === "BOWL" ? [0, 1] : player.role === "AR" ? [0.55, 0.45] : player.role === "WK" ? [0.9, 0.1] : [1, 0];
  const form = clamp(52 + 43 * (bat * weight[0] + bowl * weight[1]), 52, 95);
  const basePrice = form >= 85 ? 200 : form >= 80 ? 150 : form >= 76 ? 125 : form >= 72 ? 100 : form >= 68 ? 75 : 50;
  return {
    form,
    ppImpact: clamp(form + (tempo > 150 ? 6 : 0) + (tight !== null && tight < 7.2 ? 6 : 0) - 3, 45, 96),
    deathImpact: clamp(form + (tempo > 165 ? 8 : 0) + ((c?.wk ?? 0) > 80 ? 6 : 0) - 4, 42, 96),
    basePrice,
    vfm: clamp(58 + (form - 70) * 0.8 + (basePrice <= 75 ? 8 : basePrice <= 125 ? 4 : 0), 55, 92),
  };
}

const tagFor = (form, vfm) =>
  form >= 88 ? "Marquee" : vfm >= 78 && form < 82 ? "Steal" : form >= 76 ? "Solid" : form >= 70 ? "Watchlist" : "Punt";

const COUNTRY_CODE = {
  India: "IND", "South Africa": "SA", Australia: "AUS", England: "ENG", "New Zealand": "NZ",
  Pakistan: "PAK", "West Indies": "WI", "Sri Lanka": "SL", Afghanistan: "AFG", Bangladesh: "BAN",
};
const ROLE_CODE = { BAT: "Batter", BOWL: "Bowler", AR: "All-Rounder", WK: "Wicket-Keeper" };

const pool = JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

let displayed = 0;
for (const t of pool.teams) {
  for (const p of t.squad) {
    if (DISPLAY[p.name] && DISPLAY[p.name] !== p.name) {
      p.name = DISPLAY[p.name];
      displayed += 1;
    }
  }
}

const entries = pool.teams.flatMap((t) => t.squad.map((p) => ({ ...p, team: t.id.toUpperCase() })));

const retiredIds = new Set(
  RETIRED.map((r) => entries.find((e) => samePlayer(e.name, r.name) || [...(aliases.get(e.id) ?? [])].some((n) => samePlayer(n, r.name)))?.id)
);
const tradeIds = new Map();
for (const t of TRADES) {
  const hit = entries.find((e) => samePlayer(e.name, t.name) || [...(aliases.get(e.id) ?? [])].some((n) => samePlayer(n, t.name)));
  if (hit) tradeIds.set(hit.id, t.to);
  else console.log(`trade ${t.name} -> ${t.to}: nobody in the pool matches that name yet`);
}

/** Pool entry -> database row, only where the pairing is one-to-one. */
const usedNames = new Set(pool.teams.flatMap((t) => t.squad.map((p) => norm(p.name))));
const curated = new Set(Object.values(DISPLAY));
const pair = new Map();
const claims = new Map();
for (const row of db.players) {
  const countryOk = (e) => !COUNTRY_CODE[e.country] || COUNTRY_CODE[e.country] === row.country;
  let hits = entries.filter((e) => norm(e.name) === norm(row.name) && countryOk(e));
  if (!hits.length)
    hits = entries.filter((e) => [...(aliases.get(e.id) ?? [])].some((n) => norm(n) === norm(row.name)) && countryOk(e));
  if (!hits.length)
    hits = entries.filter(
      (e) => countryOk(e) && (samePlayer(e.name, row.name) || [...(aliases.get(e.id) ?? [])].some((n) => samePlayer(n, row.name)))
    );
  const uniq = [...new Map(hits.map((e) => [e.id, e])).values()];
  claims.set(row.name, uniq);
  for (const e of uniq) e._rows = [...(e._rows ?? []), row.name];
}
for (const row of db.players) {
  const uniq = claims.get(row.name) ?? [];
  if (uniq.length !== 1) continue;
  const e = uniq[0];
  if ((e._rows?.length ?? 1) > 1) continue;
  pair.set(e.id, row);
}

let renamed = 0;
let moved = 0;
let refreshed = 0;
for (const team of pool.teams) {
  team.squad = team.squad.filter((p) => !retiredIds.has(p.id));
  for (const p of team.squad) {
    const row = pair.get(p.id);
    if (
      row &&
      !curated.has(p.name) &&
      norm(row.name) !== norm(p.name) &&
      row.country !== "PAK" &&
      !usedNames.has(norm(row.name))
    ) {
      usedNames.delete(norm(p.name));
      usedNames.add(norm(row.name));
      p.name = row.name;
      renamed += 1;
    }
    const next = tradeIds.get(p.id);
    if (next && next !== team.id.toUpperCase()) moved += 1;
    const c = career.get(p.id);
    const s = season.get(`${p.id}|${next ?? team.id.toUpperCase()}`);
    if (c) {
      p.matches = c.matches;
      p.runs = c.runs;
      p.balls = c.balls;
      p.strikeRate = c.balls ? +sr(c.runs, c.balls).toFixed(2) : null;
      p.wickets = c.wk;
      p.economy = c.bb ? +econ(c.rc, c.bb).toFixed(2) : null;
      p.lastPlayed = c.last || null;
      p.lastSeason = (c.last || "").slice(0, 4);
      p.seasonMatches = s?.matches ?? 0;
      p.seasonRuns = s?.runs ?? 0;
      p.seasonBalls = s?.balls ?? 0;
      p.seasonWickets = s?.wk ?? 0;
      p.seasonStrikeRate = s?.balls ? +sr(s.runs, s.balls).toFixed(2) : null;
      p.seasonEconomy = s?.bb ? +econ(s.rc, s.bb).toFixed(2) : null;
      p.latestSeasonMatches = p.seasonMatches;
      refreshed += 1;
    }
  }
}
const buckets = new Map(pool.teams.map((t) => [t.id.toUpperCase(), []]));
for (const t of pool.teams) for (const p of t.squad) buckets.get(tradeIds.get(p.id) ?? t.id.toUpperCase()).push(p);
pool.teams = pool.teams.map((t) => ({
  ...t,
  squad: buckets.get(t.id.toUpperCase()).sort((a, b) => b.matches - a.matches || b.runs - a.runs),
}));
pool.season = LATEST;
pool.note = `Squad pools are every player who appeared for the franchise in IPL ${LATEST} (Cricsheet ball-by-ball, joined by registry id), plus contracted players carried over, with the trades confirmed by iplt20.com up to 10 Nov 2026 applied. Retention and release lists for 2027 are due 17 Nov 2026 and were not announced, so nothing else is assumed.`;
fs.writeFileSync(POOL_FILE, JSON.stringify(pool));

let added = 0;
let nextId = Math.max(...db.players.map((p) => p.id));
for (const t of pool.teams) {
  for (const p of t.squad) {
    const row = pair.get(p.id);
    if (row) {
      // Pakistan players have never been in the IPL, so no amount of scorebook
      // evidence should put one on a franchise list.
      const wanted = row.country === "PAK" ? "FREE AGENT" : t.id.toUpperCase();
      if (row.team !== wanted) {
        row.team = wanted;
        moved += 1;
      }
      continue;
    }
    const c = career.get(p.id);
    const s = season.get(`${p.id}|${t.id.toUpperCase()}`);
    if (!c || !s?.matches) continue;
    const e = estimate(p, c, s);
    db.players.push({
      id: ++nextId,
      name: p.name,
      country: COUNTRY_CODE[p.country] ?? p.country,
      role: ROLE_CODE[p.role] ?? "Batter",
      isActive: true,
      era: "current",
      team: t.id.toUpperCase(),
      basePrice: e.basePrice,
      form: e.form,
      ppImpact: e.ppImpact,
      deathImpact: e.deathImpact,
      vfm: e.vfm,
      punditTag: tagFor(e.form, e.vfm),
      isUncapped: Boolean(p.uncapped),
    });
    added += 1;
  }
}
for (const r of RETIRED) {
  const row = db.players.find((p) => samePlayer(p.name, r.name));
  if (row) {
    row.isActive = false;
    row.team = "FREE AGENT";
  }
}
db.version = "19.0";
db.updated = new Date().toISOString().slice(0, 10);
db.sourcing =
  "form / ppImpact / deathImpact / vfm are estimates for fantasy selection, not published ratings. IPL squad rows come from scripts/sync-ipl-squads.mjs: team is where the player actually played in IPL 2026 plus confirmed trades, the figures beside each name are real Cricsheet numbers, and the ratings for squad members are banded from that same season's batting and bowling output. A Pakistan player is never given an IPL franchise.";
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2) + "\n");

console.log(
  `pool: ${pool.teams.reduce((n, t) => n + t.squad.length, 0)} entries, ${displayed} names from squad pages, ${renamed} names expanded from the database, ${refreshed} stat refreshes\n` +
    `database: ${added} squad members added, ${moved} team corrections, version ${db.version}, ${db.players.length} rows`
);
console.log("still abbreviated:", pool.teams.flatMap((t) => t.squad.filter((p) => toks(p.name).slice(0, -1).some((x) => x.length <= 2)).map((p) => `${t.id.toUpperCase()} ${p.name}`)).join(", ") || "none");
