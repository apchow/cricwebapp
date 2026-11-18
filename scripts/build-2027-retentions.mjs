/**
 * Builds src/data/ipl-2027-retentions.json from the official retention lists
 * announced on 17 November 2026 (Cricbuzz "IPL 2027 - All retentions and
 * releases", cross-checked with Willow/TOI), joined to the Cricsheet-derived
 * IPL 2026 squad pool (src/data/ipl-squads.json).
 *
 * The published team lists omit trade-in players from the "retained" column;
 * they are added back here because the published purse/slot tables only add
 * up with them included (asserted below). Names are matched exactly or via a
 * curated alias map — never fuzzily, because initials collide (Rasikh Dar vs
 * Rasikh Salam is the same person; Rahul vs Deepak Chahar are not).
 *
 * Run: node scripts/build-2027-retentions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const squads = JSON.parse(
  readFileSync(new URL("../src/data/ipl-squads.json", import.meta.url), "utf8")
);

const SALARY_CAP_CR = 120;
const MAX_SQUAD = 25;
const MIN_SQUAD = 18;
const MAX_OVERSEAS = 8;

/** Official name -> dataset display name. Same person, different spelling. */
const ALIASES = {
  "Raj Angad Bawa": "Raj Bawa",
  "Varun Chakaravarthy": "Varun Chakravarthy",
  "Rasikh Dar": "Rasikh Salam",
  "Vaibhav Sooryavanshi": "Vaibhav Suryavanshi",
  "Yash Punja": "Yash Raj Punja",
  "Tejasvi Singh Dahiya": "Tejasvi Dahiya",
  "Blessing Muzarbani": "Blessing Muzarabani",
  "Abhishek Porel": "Abishek Porel",
  "V Vyshak": "Vijaykumar Vyshak",
  "Akshat Raghuvanshi": "Akshat Raghuwanshi",
};

/**
 * Players in the official lists who never appeared in a Cricsheet IPL 2026
 * scorecard, so the squad pool has no record of them. Metadata is editorial:
 * role and country are factual, impact/value are estimates for the sim.
 * [role, country, uncapped, impact, valueCr]
 */
const EXTRA = {
  "Shreyas Gopal": ["BOWL", "India", true, 52, 0.8],
  "Jack Edwards": ["AR", "Australia", true, 55, 1.5],
  "Zak Foulkes": ["AR", "England", true, 40, 0.5],
  "Kuldip Yadav": ["BOWL", "India", true, 35, 0.3],
  "Macneil Noronha": ["AR", "India", true, 35, 0.3],
  "Aman Khan": ["AR", "India", true, 42, 0.4],
  "Akash Madhwal": ["BOWL", "India", true, 55, 0.8],
  "Dian Forrester": ["AR", "South Africa", true, 40, 0.5],
  "Atharva Ankolekar": ["BOWL", "India", true, 38, 0.3],
  "Keshav Maharaj": ["BOWL", "South Africa", false, 72, 3],
  "Mahipal Lomror": ["AR", "India", true, 50, 0.7],
  "Mohammed Izhar": ["BOWL", "India", true, 32, 0.2],
  "Ruchit Ahir": ["BOWL", "India", true, 32, 0.2],
  "Kanishk Chouhan": ["BOWL", "India", true, 35, 0.2],
  "Vicky Ostwal": ["BOWL", "India", true, 40, 0.3],
  "Jordan Cox": ["WK", "England", false, 62, 2],
  "Yash Dayal": ["BOWL", "India", true, 55, 0.9],
  "Mangesh Yadav": ["BOWL", "India", true, 38, 0.3],
  "Swapnil Singh": ["AR", "India", true, 42, 0.4],
  "Satvik Deswal": ["BOWL", "India", true, 30, 0.2],
  "Vihaan Malhotra": ["BAT", "India", true, 30, 0.2],
  "Richard Gleeson": ["BOWL", "England", true, 52, 0.7],
  "Harshit Rana": ["BOWL", "India", false, 74, 5],
  "Prashant Solanki": ["BOWL", "India", true, 38, 0.3],
  "Sarthak Ranjan": ["BAT", "India", true, 32, 0.2],
  "Mustafizur Rahman": ["BOWL", "Bangladesh", false, 74, 3],
  "Rachin Ravindra": ["AR", "New Zealand", false, 76, 5],
  "Akash Deep": ["BOWL", "India", false, 68, 2],
  "Rahul Tripathi": ["BAT", "India", true, 55, 0.9],
  "Umran Malik": ["BOWL", "India", false, 62, 1.5],
  "Daksh Kamra": ["BAT", "India", true, 30, 0.2],
  "Luvinith Sisodia": ["BAT", "India", true, 30, 0.2],
  "Brydon Carse": ["BOWL", "England", false, 68, 2.5],
  "Krans Fuletra": ["BAT", "India", true, 32, 0.2],
  "Nathan Ellis": ["BOWL", "Australia", false, 68, 2],
  "Gerald Coetzee": ["BOWL", "South Africa", false, 68, 2.5],
  "Shivam Mavi": ["BOWL", "India", true, 55, 0.9],
  "Kamindu Mendis": ["AR", "Sri Lanka", false, 66, 2],
  "Onkar Tarmale": ["BOWL", "India", true, 32, 0.2],
  "Amit Kumar": ["BOWL", "India", true, 32, 0.2],
  "RS Ambrish": ["BAT", "India", true, 34, 0.3],
  "Abhinav Manohar": ["BAT", "India", true, 48, 0.6],
  "Aman Rao Perala": ["BOWL", "India", true, 32, 0.2],
  "Kuldeep Sen": ["BOWL", "India", true, 48, 0.5],
  "Yudhvir Singh": ["AR", "India", true, 45, 0.5],
  "Kwena Maphaka": ["BOWL", "South Africa", false, 60, 1.2],
  "Vignesh Puthur": ["BOWL", "India", true, 35, 0.2],
  "Emanjot Singh Chahal": ["BOWL", "India", true, 30, 0.2],
  "Prithvi Shaw": ["BAT", "India", false, 66, 2],
  "Zeeshan Ansari": ["BOWL", "India", true, 48, 0.5],
  "Ben Duckett": ["WK", "England", false, 74, 4],
  "Rehan Ahmed": ["AR", "England", false, 62, 1.5],
  "Ajay Mandal": ["AR", "India", true, 35, 0.2],
  "Harnoor Singh": ["WK", "India", true, 35, 0.2],
  "Musheer Khan": ["BAT", "India", true, 42, 0.3],
  "Mitchell Owen": ["AR", "Australia", false, 60, 1.2],
  "Pyla Avinash": ["BOWL", "India", true, 30, 0.2],
  "Praveen Dubey": ["BOWL", "India", true, 38, 0.3],
  "Vishal Nishad": ["BOWL", "India", true, 30, 0.2],
  "Gurnoor Brar": ["BOWL", "India", true, 38, 0.3],
  "Jayant Yadav": ["BOWL", "India", true, 50, 0.6],
  "Anuj Rawat": ["WK", "India", true, 48, 0.5],
  "Tom Banton": ["WK", "England", false, 62, 1.5],
  "Ishant Sharma": ["BOWL", "India", false, 62, 1],
  "Luke Wood": ["BOWL", "England", false, 60, 1.2],
  "Prithviraj Yarra": ["BOWL", "India", true, 30, 0.2],
  "Connor Esterhuizen": ["BAT", "South Africa", true, 40, 0.4],
  "Sam Curran": ["AR", "England", false, 76, 6],
  "Wanindu Hasaranga": ["BOWL", "Sri Lanka", false, 76, 4],
  "Matthew Breetzke": ["BAT", "South Africa", false, 58, 1],
  "Naman Tiwari": ["BOWL", "India", true, 35, 0.2],
  "Himmat Singh": ["BAT", "India", true, 45, 0.4],
};

/**
 * Official lists, 17 Nov 2026. Trade-ins are included in `retained` (the
 * published slot counts prove they must be); `trades` documents the swaps.
 * `unlistedReleased` are squad-pool players absent from both published
 * columns — treated as released, flagged in the output note.
 */
const OFFICIAL = {
  csk: {
    purseCr: 28.05, slots: 6, overseasSlots: 2,
    trades: { in: ["Liam Livingstone", "Jack Edwards"], out: ["Khaleel Ahmed", "Nathan Ellis"] },
    retained: [
      "Ruturaj Gaikwad", "Sanju Samson", "Kartik Sharma", "Urvil Patel",
      "Sarfaraz Khan", "Ayush Mhatre", "Dewald Brevis", "Noor Ahmad",
      "Akeal Hosein", "Mukesh Choudhary", "Jamie Overton", "Shivam Dube",
      "Ramakrishna Ghosh", "Gurjapneet Singh", "Anshul Kamboj", "Shreyas Gopal",
      "Rahul Chahar", "Liam Livingstone", "Jack Edwards",
    ],
    released: [
      "Matt Henry", "Matt Short", "Zak Foulkes", "Kuldip Yadav",
      "Prashant Veer", "Macneil Noronha", "Aman Khan", "Spencer Johnson",
      "Akash Madhwal", "Dian Forrester",
    ],
    retired: ["MS Dhoni"],
    unlistedReleased: [],
  },
  mi: {
    purseCr: 32.6, slots: 9, overseasSlots: 2,
    trades: { in: ["Arshdeep Singh"], out: ["Hardik Pandya"] },
    retained: [
      "Arshdeep Singh", "Ashwani Kumar", "Corbin Bosch", "Jasprit Bumrah",
      "Mitchell Santner", "Naman Dhir", "Quinton de Kock", "Raghu Sharma",
      "Raj Angad Bawa", "Rohit Sharma", "Ryan Rickelton", "Shardul Thakur",
      "Sherfane Rutherford", "Suryakumar Yadav", "Tilak Varma", "Will Jacks",
    ],
    released: [
      "AM Ghazanfar", "Atharva Ankolekar", "Danish Malewar", "Deepak Chahar",
      "Keshav Maharaj", "Krish Bhagat", "Mahipal Lomror", "Mayank Markande",
      "Mayank Rawat", "Mohammed Izhar", "Robin Minz", "Ruchit Ahir", "Trent Boult",
    ],
    retired: [],
    unlistedReleased: [],
  },
  rcb: {
    purseCr: 14.15, slots: 5, overseasSlots: 1,
    trades: { in: [], out: [] },
    retained: [
      "Abhinandan Singh", "Kanishk Chouhan", "Suyash Sharma", "Bhuvneshwar Kumar",
      "Krunal Pandya", "Tim David", "Devdutt Padikkal", "Nuwan Thushara",
      "Venkatesh Iyer", "Jacob Duffy", "Phil Salt", "Vicky Ostwal",
      "Jitesh Sharma", "Rajat Patidar", "Virat Kohli", "Jordan Cox",
      "Rasikh Dar", "Yash Dayal", "Josh Hazlewood", "Romario Shepherd",
    ],
    released: [
      "Mangesh Yadav", "Jacob Bethell", "Swapnil Singh", "Satvik Deswal",
      "Vihaan Malhotra", "Richard Gleeson",
    ],
    retired: [],
    unlistedReleased: ["Mayank Agarwal"],
  },
  kkr: {
    purseCr: 41.65, slots: 8, overseasSlots: 3,
    trades: { in: [], out: [] },
    retained: [
      "Angkrish Raghuvanshi", "Anukul Roy", "Cameron Green", "Finn Allen",
      "Harshit Rana", "Kartik Tyagi", "Manish Pandey", "Prashant Solanki",
      "Ramandeep Singh", "Rinku Singh", "Rovman Powell", "Sarthak Ranjan",
      "Saurabh Dubey", "Sunil Narine", "Tim Seifert", "Vaibhav Arora",
      "Varun Chakaravarthy",
    ],
    released: [
      "Matheesha Pathirana", "Mustafizur Rahman", "Tejasvi Singh Dahiya",
      "Rachin Ravindra", "Akash Deep", "Blessing Muzarbani",
      "Navdeep Saini", "Rahul Tripathi", "Umran Malik", "Daksh Kamra",
      "Luvinith Sisodia",
    ],
    retired: ["Ajinkya Rahane"],
    unlistedReleased: [],
  },
  srh: {
    purseCr: 40.15, slots: 7, overseasSlots: 3,
    trades: { in: ["Khaleel Ahmed", "Nathan Ellis", "T Natarajan"], out: ["Liam Livingstone", "Jack Edwards", "Harshal Patel"] },
    retained: [
      "Pat Cummins", "Abhishek Sharma", "Ishan Kishan", "Heinrich Klaasen",
      "Nitish Kumar Reddy", "Brydon Carse", "Salil Arora", "Aniket Verma",
      "Harsh Dubey", "Smaran Ravichandran", "Praful Hinge", "Sakib Hussain",
      "Shivang Kumar", "Krans Fuletra", "Eshan Malinga",
      "Khaleel Ahmed", "Nathan Ellis", "T Natarajan",
    ],
    released: [
      "Travis Head", "Gerald Coetzee", "David Payne", "Jaydev Unadkat",
      "Shivam Mavi", "Kamindu Mendis", "Dilshan Madushanka", "Onkar Tarmale",
      "Amit Kumar", "RS Ambrish",
    ],
    retired: [],
    unlistedReleased: ["Abhinav Manohar"],
  },
  rr: {
    purseCr: 27.05, slots: 6, overseasSlots: 3,
    trades: { in: ["Mohammed Shami", "Manimaran Siddharth"], out: ["Sam Curran"] },
    retained: [
      "Riyan Parag", "Yashasvi Jaiswal", "Vaibhav Sooryavanshi", "Ravindra Jadeja",
      "Dhruv Jurel", "Jofra Archer", "Aman Rao Perala", "Brijesh Sharma",
      "Nandre Burger", "Dasun Shanaka", "Donovan Ferreira", "Lhuan-dre Pretorius",
      "Ravi Bishnoi", "Sandeep Sharma", "Shubham Dubey", "Sushant Mishra",
      "Yash Punja", "Mohammed Shami", "Manimaran Siddharth",
    ],
    released: [
      "Tushar Deshpande", "Adam Milne", "Kuldeep Sen", "Yudhvir Singh",
      "Kwena Maphaka", "Vignesh Puthur", "Shimron Hetmyer", "Ravi Singh",
      "Emanjot Singh Chahal",
    ],
    retired: [],
    unlistedReleased: [],
  },
  dc: {
    purseCr: 39.5, slots: 9, overseasSlots: 4,
    trades: { in: ["Rishabh Pant", "Zeeshan Ansari"], out: ["Kuldeep Yadav", "T Natarajan"] },
    retained: [
      "Ashutosh Sharma", "Auqib Nabi", "Axar Patel", "David Miller",
      "KL Rahul", "Kyle Jamieson", "Lungi Ngidi", "Madhav Tiwari",
      "Mukesh Kumar", "Prithvi Shaw", "Rishabh Pant", "Sameer Rizvi",
      "Tripurana Vijay", "Tristan Stubbs", "Vipraj Nigam", "Zeeshan Ansari",
    ],
    released: [
      "Mitchell Starc", "Nitish Rana", "Abhishek Porel", "Pathum Nissanka",
      "Karun Nair", "Sahil Parakh", "Dushmantha Chameera",
      "Rehan Ahmed", "Ajay Mandal",
    ],
    retired: [],
    unlistedReleased: ["Ben Duckett"],
  },
  pbks: {
    purseCr: 18.6, slots: 6, overseasSlots: 2,
    trades: { in: ["Hardik Pandya"], out: ["Arshdeep Singh"] },
    retained: [
      "Shreyas Iyer", "Marco Jansen", "Marcus Stoinis", "Hardik Pandya",
      "Shashank Singh", "Prabhsimran Singh", "Harpreet Brar", "Priyansh Arya",
      "Yuzvendra Chahal", "Harnoor Singh", "Azmatullah Omarzai", "Yash Thakur",
      "V Vyshak", "Vishnu Vinod", "Ben Dwarshuis", "Cooper Connolly",
      "Musheer Khan", "Xavier Bartlett", "Suryansh Shedge",
    ],
    released: [
      "Nehal Wadhera", "Mitchell Owen", "Lockie Ferguson", "Pyla Avinash",
      "Praveen Dubey", "Vishal Nishad",
    ],
    retired: [],
    unlistedReleased: [],
  },
  gt: {
    purseCr: 8.75, slots: 3, overseasSlots: 2,
    trades: { in: ["Harshal Patel"], out: [] },
    retained: [
      "Shubman Gill", "Sai Sudharsan", "Jos Buttler", "Gurnoor Brar",
      "R Sai Kishore", "Mohammed Siraj", "Washington Sundar", "Rashid Khan",
      "Kumar Kushagra", "Jayant Yadav", "Arshad Khan", "Kagiso Rabada",
      "Prasidh Krishna", "Jason Holder", "Nishant Sindhu", "Manav Suthar",
      "Rahul Tewatia", "Anuj Rawat", "Glenn Phillips", "Ashok Sharma",
      "Harshal Patel", "Tom Banton",
    ],
    released: [
      "Shahrukh Khan", "Ishant Sharma", "Luke Wood", "Kulwant Khejroliya",
      "Prithviraj Yarra", "Connor Esterhuizen",
    ],
    retired: [],
    unlistedReleased: [],
  },
  lsg: {
    purseCr: 47.45, slots: 7, overseasSlots: 3,
    trades: { in: ["Kuldeep Yadav", "Sam Curran"], out: ["Rishabh Pant", "Mohammed Shami", "Manimaran Siddharth"] },
    retained: [
      "Abdul Samad", "Digvesh Rathi", "Nicholas Pooran", "Aiden Markram",
      "Josh Inglis", "Prince Yadav", "Akash Singh", "Kuldeep Yadav",
      "Sam Curran", "Akshat Raghuvanshi", "Mayank Yadav", "Shahbaz Ahmed",
      "Arjun Tendulkar", "Mitchell Marsh", "Arshin Kulkarni", "Mohsin Khan",
      "Ayush Badoni", "Mukul Choudhary",
    ],
    released: [
      "Avesh Khan", "Anrich Nortje", "Wanindu Hasaranga", "Matthew Breetzke",
      "George Linde", "Naman Tiwari",
    ],
    retired: [],
    unlistedReleased: ["Himmat Singh"],
  },
};

// ---- index the squad pool by display name ------------------------------------
const byName = new Map();
for (const team of squads.teams) {
  for (const p of team.squad) {
    if (byName.has(p.name)) throw new Error(`duplicate pool name ${p.name}`);
    byName.set(p.name, { ...p, formerTeam: team.id });
  }
}

function basePriceFor(impact, valueCr, uncapped) {
  if (uncapped) return impact >= 55 ? 0.3 : 0.2;
  if (valueCr >= 10) return 2;
  if (valueCr >= 6) return 1.5;
  if (valueCr >= 3) return 1;
  if (valueCr >= 1.5) return 0.75;
  return 0.5;
}

const usedIds = new Set();
function resolve(name, teamId) {
  const canonical = ALIASES[name] ?? name;
  const pooled = byName.get(canonical);
  let rec;
  if (pooled) {
    rec = {
      id: pooled.id,
      name: pooled.name,
      role: pooled.role,
      country: pooled.country,
      overseas: Boolean(pooled.overseas),
      uncapped: Boolean(pooled.uncapped),
      impact: pooled.impact ?? 40,
      valueCr: pooled.retentionValue ?? 1,
      iplMatches: pooled.matches ?? 0,
      runs: pooled.runs ?? 0,
      wickets: pooled.wickets ?? 0,
      strikeRate: pooled.strikeRate ?? null,
      economy: pooled.economy ?? null,
      seasonRuns: pooled.seasonRuns ?? 0,
      seasonBalls: pooled.seasonBalls ?? 0,
      seasonWickets: pooled.seasonWickets ?? 0,
      seasonStrikeRate: pooled.seasonStrikeRate ?? null,
      seasonEconomy: pooled.seasonEconomy ?? null,
      latestSeasonMatches: pooled.latestSeasonMatches ?? 0,
      formerTeam: teamId,
    };
  } else {
    const extra = EXTRA[name];
    if (!extra) throw new Error(`no metadata for "${name}" (${teamId})`);
    const [role, country, uncapped, impact, valueCr] = extra;
    rec = {
      id: `x-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      role,
      country,
      overseas: country !== "India",
      uncapped,
      impact,
      valueCr,
      iplMatches: 0,
      runs: 0,
      wickets: 0,
      strikeRate: null,
      economy: null,
      seasonRuns: 0,
      seasonBalls: 0,
      seasonWickets: 0,
      seasonStrikeRate: null,
      seasonEconomy: null,
      latestSeasonMatches: 0,
      formerTeam: teamId,
    };
  }
  if (usedIds.has(rec.id)) throw new Error(`player listed twice: ${name}`);
  usedIds.add(rec.id);
  rec.basePriceCr = basePriceFor(rec.impact, rec.valueCr, rec.uncapped);
  return rec;
}

// ---- build + validate ---------------------------------------------------------
const teams = [];
for (const team of squads.teams) {
  const o = OFFICIAL[team.id];
  if (!o) throw new Error(`missing official data for ${team.id}`);
  const retained = o.retained.map((n) => resolve(n, team.id));
  const released = [...o.released, ...o.unlistedReleased].map((n) => resolve(n, team.id));

  const assert = (cond, msg) => {
    if (!cond) throw new Error(`${team.id}: ${msg}`);
  };
  assert(retained.length === MAX_SQUAD - o.slots, `retained ${retained.length} != 25 - ${o.slots} slots`);
  assert(retained.filter((p) => p.overseas).length === MAX_OVERSEAS - o.overseasSlots, "overseas retained mismatch");
  assert(o.purseCr > 0 && o.purseCr <= SALARY_CAP_CR, "purse out of range");
  teams.push({
    id: team.id,
    purseCr: o.purseCr,
    slots: o.slots,
    overseasSlots: o.overseasSlots,
    trades: o.trades,
    retired: o.retired,
    unlistedReleased: o.unlistedReleased,
    retained,
    released,
  });
}

const totalPurse = teams.reduce((s, t) => s + t.purseCr, 0);
if (Math.abs(totalPurse - 297.95) > 0.01) {
  throw new Error(`combined purse ${totalPurse} != published 297.95`);
}

const out = {
  season: "2027",
  announced: "2026-11-17",
  auctionDate: "2026-12-16",
  auctionVenue: "Goa",
  salaryCapCr: SALARY_CAP_CR,
  minSquad: MIN_SQUAD,
  maxSquad: MAX_SQUAD,
  maxOverseas: MAX_OVERSEAS,
  source:
    "Cricbuzz 'IPL 2027 - All retentions and releases' (17 Nov 2026), cross-checked against Willow Sports / Times of India. Trade-in players are included in retained lists to match the published purse and slot tables.",
  note:
    "Per-player retention salaries were not published; purse and slot figures are official. MS Dhoni (CSK mentor) and Ajinkya Rahane retired and are not in the auction pool. Player impact and value ratings are editorial estimates for the simulation. Mayank Agarwal, Abhinav Manohar and Ben Duckett appear in neither published column and are treated as released. Auction pool is provisional until the official register on 3 Dec 2026.",
  teams,
};

writeFileSync(
  new URL("../src/data/ipl-2027-retentions.json", import.meta.url),
  JSON.stringify(out, null, 1) + "\n"
);

const poolSize = teams.reduce((s, t) => s + t.released.length, 0);
console.log(
  `OK: ${teams.length} teams, ${usedIds.size} players, auction pool ${poolSize}, combined purse ₹${totalPurse.toFixed(2)}cr`
);