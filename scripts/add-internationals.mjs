/**
 * Expand the player database toward full international coverage.
 *
 * The dataset in public/data/players.json was India-heavy (112 active) with
 * only 5 New Zealanders, so no New Zealand XI could be named and the stats hub
 * was effectively an IPL list. This script adds current international players
 * for every Full Member.
 *
 * Ratings are editorial: `form`, `ppImpact`, `deathImpact` and `vfm` are
 * judgement estimates for fantasy selection, not match-derived statistics.
 * `team` is left as FREE AGENT on purpose — franchise affiliation is not needed
 * for international selection and guessing it would put false facts in the data.
 *
 * Usage: node scripts/add-internationals.mjs
 * Re-running is safe: existing names are skipped, so nothing duplicates.
 */
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "public", "data", "players.json");

/** [name, country, role, form, ppImpact, deathImpact, vfm, basePriceLakhs] */
const ADDITIONS = [
  // ── New Zealand ──────────────────────────────────────────
  ["Kane Williamson", "NZ", "Batter", 88, 82, 74, 78, 200],
  ["Tom Latham", "NZ", "Wicket-Keeper", 82, 76, 62, 80, 150],
  ["Daryl Mitchell", "NZ", "All-Rounder", 85, 72, 78, 79, 150],
  ["Glenn Phillips", "NZ", "Batter", 80, 88, 66, 74, 125],
  ["Michael Bracewell", "NZ", "All-Rounder", 76, 62, 70, 76, 100],
  ["Mark Chapman", "NZ", "Batter", 78, 70, 58, 75, 100],
  ["Tim Southee", "NZ", "Bowler", 79, 74, 60, 78, 125],
  ["Adam Milne", "NZ", "Bowler", 74, 78, 52, 68, 100],
  ["Jacob Duffy", "NZ", "Bowler", 76, 66, 72, 74, 100],
  ["Ish Sodhi", "NZ", "Bowler", 73, 58, 68, 76, 75],

  // ── Pakistan ─────────────────────────────────────────────
  ["Babar Azam", "PAK", "Batter", 91, 84, 76, 76, 200],
  ["Mohammad Rizwan", "PAK", "Wicket-Keeper", 86, 78, 70, 80, 150],
  ["Shaheen Afridi", "PAK", "Bowler", 85, 90, 64, 76, 150],
  ["Naseem Shah", "PAK", "Bowler", 78, 84, 60, 74, 125],
  ["Haris Rauf", "PAK", "Bowler", 79, 72, 82, 76, 125],
  ["Shadab Khan", "PAK", "All-Rounder", 74, 62, 68, 70, 100],
  ["Imam-ul-Haq", "PAK", "Batter", 80, 70, 64, 78, 100],
  ["Fakhar Zaman", "PAK", "Batter", 77, 86, 58, 72, 100],
  ["Saim Ayub", "PAK", "Batter", 76, 80, 54, 79, 75],
  ["Abdullah Shafique", "PAK", "Batter", 75, 68, 60, 77, 75],
  ["Salman Ali Agha", "PAK", "All-Rounder", 74, 64, 66, 75, 75],
  ["Sahibzada Farhan", "PAK", "Batter", 73, 72, 56, 71, 75],
  ["Usama Mir", "PAK", "Bowler", 74, 58, 70, 76, 75],
  ["Mir Hamza", "PAK", "Bowler", 71, 64, 58, 72, 50],
  ["Aamer Jamal", "PAK", "All-Rounder", 73, 60, 72, 74, 75],

  // ── Bangladesh ───────────────────────────────────────────
  ["Shakib Al Hasan", "BAN", "All-Rounder", 82, 68, 76, 80, 150],
  ["Litton Das", "BAN", "Wicket-Keeper", 81, 78, 62, 78, 125],
  ["Najmul Hossain Shanto", "BAN", "Batter", 79, 70, 66, 79, 100],
  ["Towhid Hridoy", "BAN", "Batter", 78, 74, 64, 80, 100],
  ["Mehidy Hasan Miraz", "BAN", "All-Rounder", 77, 60, 72, 81, 100],
  ["Nurul Hasan", "BAN", "Wicket-Keeper", 72, 66, 58, 74, 75],
  ["Anamul Haque", "BAN", "Batter", 71, 68, 56, 72, 50],
  ["Afif Hossain", "BAN", "All-Rounder", 72, 64, 60, 73, 50],
  ["Yasir Ali", "BAN", "Batter", 70, 66, 54, 71, 50],
  ["Taskin Ahmed", "BAN", "Bowler", 74, 76, 58, 74, 100],
  ["Mustafizur Rahman", "BAN", "Bowler", 78, 70, 66, 78, 125],
  ["Hasan Mahmud", "BAN", "Bowler", 72, 74, 56, 70, 75],
  ["Tanzim Hasan Sakib", "BAN", "Bowler", 71, 62, 64, 73, 50],
  ["Ebadot Hossain", "BAN", "Bowler", 69, 58, 62, 70, 50],
  ["Nasum Ahmed", "BAN", "Bowler", 70, 56, 66, 72, 50],

  // ── Afghanistan ──────────────────────────────────────────
  ["Mohammad Nabi", "AFG", "All-Rounder", 80, 66, 74, 82, 125],
  ["Gulbadin Naib", "AFG", "All-Rounder", 72, 62, 68, 72, 75],
  ["Hashmatullah Shahidi", "AFG", "Batter", 78, 66, 70, 79, 100],
  ["Rahmanullah Gurbaz", "AFG", "Wicket-Keeper", 80, 86, 58, 76, 125],
  ["Ibrahim Zadran", "AFG", "Batter", 81, 74, 62, 78, 125],
  ["Mujeeb Ur Rahman", "AFG", "Bowler", 76, 60, 72, 77, 100],
  ["Naveen-ul-Haq", "AFG", "Bowler", 75, 68, 74, 76, 100],
  ["Sharafuddin Ashraf", "AFG", "All-Rounder", 70, 58, 64, 71, 50],
  ["Karim Janat", "AFG", "All-Rounder", 72, 64, 62, 73, 50],
  ["Darwish Rasooli", "AFG", "Batter", 73, 70, 58, 72, 50],
  ["Fareed Ahmad", "AFG", "Bowler", 69, 56, 66, 70, 50],

  // ── Sri Lanka ────────────────────────────────────────────
  ["Pathum Nissanka", "SL", "Batter", 84, 80, 64, 80, 150],
  ["Charith Asalanka", "SL", "Batter", 79, 70, 66, 78, 100],
  ["Dhananjaya de Silva", "SL", "All-Rounder", 77, 62, 70, 77, 100],
  ["Dimuth Karunaratne", "SL", "Batter", 75, 64, 58, 74, 75],
  ["Angelo Mathews", "SL", "All-Rounder", 73, 60, 68, 73, 75],
  ["Lahiru Kumara", "SL", "Bowler", 74, 72, 60, 72, 100],
  ["Vishwa Fernando", "SL", "Bowler", 70, 62, 58, 71, 50],
  ["Sadeera Samarawickrama", "SL", "Wicket-Keeper", 73, 74, 56, 73, 50],
  ["Dilshan Madushanka", "SL", "Bowler", 71, 70, 56, 70, 50],

  // ── West Indies ──────────────────────────────────────────
  ["Jason Holder", "WI", "All-Rounder", 76, 62, 72, 76, 100],
  ["Alzarri Joseph", "WI", "Bowler", 78, 76, 64, 75, 125],
  ["Gudakesh Motie", "WI", "Bowler", 76, 58, 72, 79, 100],
  ["Akeal Hosein", "WI", "All-Rounder", 74, 60, 70, 78, 75],
  ["Brandon King", "WI", "Batter", 77, 78, 58, 74, 100],
  ["Kyle Mayers", "WI", "All-Rounder", 75, 72, 62, 73, 75],
  ["Odean Smith", "WI", "All-Rounder", 72, 66, 68, 71, 50],

  // ── England ──────────────────────────────────────────────
  ["Joe Root", "ENG", "Batter", 93, 80, 78, 78, 200],
  ["Ben Stokes", "ENG", "All-Rounder", 87, 76, 82, 74, 200],
  ["Harry Brook", "ENG", "Batter", 86, 88, 70, 76, 150],
  ["Adil Rashid", "ENG", "Bowler", 80, 60, 76, 80, 125],
  ["Mark Wood", "ENG", "Bowler", 78, 80, 62, 72, 125],
  ["Brydon Carse", "ENG", "All-Rounder", 75, 68, 70, 74, 75],

  // ── Australia ────────────────────────────────────────────
  ["Usman Khawaja", "AUS", "Batter", 85, 72, 74, 77, 150],
  ["Alex Carey", "AUS", "Wicket-Keeper", 77, 68, 58, 75, 100],

  // ── South Africa ─────────────────────────────────────────
  ["Keshav Maharaj", "SA", "Bowler", 80, 58, 74, 80, 125],
  ["Temba Bavuma", "SA", "Batter", 76, 66, 58, 74, 100],
];

function tagFor(form, vfm) {
  if (form >= 88) return "Marquee";
  if (vfm >= 78 && form < 82) return "Steal";
  if (form >= 76) return "Solid";
  if (form >= 70) return "Watchlist";
  return "Punt";
}

const dataset = JSON.parse(fs.readFileSync(FILE, "utf8"));
const existingNames = new Set(dataset.players.map((p) => p.name.toLowerCase()));
let nextId = Math.max(...dataset.players.map((p) => p.id)) + 1;

const added = [];
const skipped = [];

for (const [name, country, role, form, ppImpact, deathImpact, vfm, basePrice] of ADDITIONS) {
  if (existingNames.has(name.toLowerCase())) {
    skipped.push(name);
    continue;
  }
  existingNames.add(name.toLowerCase());
  added.push({
    id: nextId++,
    name,
    country,
    role,
    isActive: true,
    era: "current",
    team: "FREE AGENT",
    basePrice,
    form,
    ppImpact,
    deathImpact,
    vfm,
    punditTag: tagFor(form, vfm),
    isUncapped: false,
  });
}

dataset.players.push(...added);
dataset.version = "17.0";
dataset.updated = new Date().toISOString().slice(0, 10);
dataset.sourcing =
  "form / ppImpact / deathImpact / vfm are editorial estimates for fantasy selection, " +
  "not match-derived statistics. International additions by scripts/add-internationals.mjs.";

fs.writeFileSync(FILE, JSON.stringify(dataset, null, 2) + "\n");

const byCountry = {};
for (const player of dataset.players) {
  if (!player.isActive) continue;
  byCountry[player.country] = (byCountry[player.country] || 0) + 1;
}
console.log(`added ${added.length}, skipped duplicates ${skipped.length}`);
console.log(
  "active per country:",
  Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}:${n}`)
    .join(" ")
);
console.log("total active:", Object.values(byCountry).reduce((a, b) => a + b, 0));
