import dataset from "../../public/data/players.json";
import auction from "./ipl-2027-retentions.json";

export interface Tool {
  id: string;
  href: string;
  emoji: string;
  /** Short label used in the navigation. */
  navLabel: string;
  /** Product name shown on the hub card. */
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  /** Tailwind gradient used for the card border on hover. */
  cardGradient: string;
  /** Tailwind background used for the card glow. */
  glow: string;
}

/**
 * Counts the hub cards advertise, derived from the data itself so a player
 * addition cannot leave a stale number on the home page.
 */
const AUCTION_POOL_SIZE = auction.teams.reduce(
  (sum, team) => sum + team.released.length,
  0
);

const DATABASE_SIZE = dataset.players.length;

/**
 * Single source of truth for the arena. Navigation and the hub cards both
 * render from this list so a rename only has to happen once.
 */
export const TOOLS: Tool[] = [
  {
    id: "auction",
    href: "/auction",
    emoji: "🔨",
    navLabel: "IPL Auction",
    title: "IPL Auction 2027",
    subtitle: "Mini Auction Room",
    description:
      "The real 17 Nov retentions — or your own. Take a paddle, bid against nine rival franchises and face the verdict on your squad.",
    features: [`${AUCTION_POOL_SIZE} players on the block`, "Official purses & slots", "Live bidding sim"],
    cardGradient: "from-amber-500 to-yellow-900",
    glow: "bg-amber-500/20",
  },
  {
    id: "xi-builder",
    href: "/xi-builder",
    emoji: "👥",
    navLabel: "XI Builder",
    title: "XI Builder",
    subtitle: "Squad Architect",
    description:
      "Drag your eleven onto the pitch, hand out the captaincy, and keep an eye on the overseas cap while you build.",
    features: ["Drag & drop", "Max 4 overseas", "Captain + VC"],
    cardGradient: "from-blue-600 to-indigo-900",
    glow: "bg-blue-500/20",
  },
  {
    id: "scorer",
    href: "/scorer",
    emoji: "📊",
    navLabel: "Scorer",
    title: "Pro Scorer",
    subtitle: "Ball by Ball",
    description:
      "A thumb-friendly scoring pad that keeps up with the game. Every run, every wicket, saved as you go.",
    features: ["Big tap targets", "Undo & redo", "Auto-saved"],
    cardGradient: "from-green-600 to-emerald-900",
    glow: "bg-emerald-500/20",
  },
  {
    id: "history",
    href: "/history",
    emoji: "📒",
    navLabel: "History",
    title: "Match Centre",
    subtitle: "History & Analytics",
    description:
      "Every match you have scored, with the full scorecard, the run worm and your career batting and bowling leaderboards.",
    features: ["Full scorecards", "Run worm", "Career figures"],
    cardGradient: "from-amber-500 to-orange-900",
    glow: "bg-amber-500/20",
  },
  {
    id: "series",
    href: "/series",
    emoji: "🏆",
    navLabel: "Series",
    title: "Series & Tournaments",
    subtitle: "Points Table",
    description:
      "Pull your matches into a tournament and let the points table and net run rate sort the bragging rights out.",
    features: ["Points table", "Net run rate", "Multi-match"],
    cardGradient: "from-cyan-500 to-blue-900",
    glow: "bg-cyan-500/20",
  },
  {
    id: "mini-game",
    href: "/mini-game",
    emoji: "⚡",
    navLabel: "Street Strike",
    title: "Street Strike",
    subtitle: "Timing Challenge",
    description:
      "A neon-glow batting challenge. Read the delivery, pick your gap, and time the swing for a maximum.",
    features: ["Canvas engine", "Timing meter", "Screen shake"],
    cardGradient: "from-orange-500 to-red-900",
    glow: "bg-orange-500/20",
  },
  {
    id: "players",
    href: "/players",
    emoji: "📈",
    navLabel: "Players",
    title: "Stats Hub",
    subtitle: "Player Stats",
    description:
      "Search the full database by role, franchise and price, then dig into the figures from your own scored matches.",
    features: [`${DATABASE_SIZE} in the database`, "Role filters", "Your figures"],
    cardGradient: "from-sky-500 to-violet-900",
    glow: "bg-sky-500/20",
  },
  {
    id: "banter",
    href: "/banter",
    emoji: "💬",
    navLabel: "Banter",
    title: "Banter Wall",
    subtitle: "The Group Chat",
    description:
      "Hot takes, cold takes and everything between. Post your reaction, drop a like, and try not to get silenced.",
    features: ["Live feed", "Reactions", "Paid to Cope"],
    cardGradient: "from-fuchsia-500 to-purple-900",
    glow: "bg-fuchsia-500/20",
  },
];
