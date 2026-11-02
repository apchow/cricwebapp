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
 * Single source of truth for the arena. Navigation and the hub cards both
 * render from this list so a rename only has to happen once.
 */
export const TOOLS: Tool[] = [
  {
    id: "retention",
    href: "/retention",
    emoji: "🔒",
    navLabel: "Retention",
    title: "Retention 2027",
    subtitle: "Auction Room",
    description:
      "Pick the six you refuse to lose. Four capped, two uncapped. Lock the squad and share it with your group chat.",
    features: ["185 players", "Strict rules", "Shareable squad"],
    cardGradient: "from-emerald-500 to-teal-900",
    glow: "bg-emerald-500/20",
  },
  {
    id: "xi-builder",
    href: "/xi-builder",
    emoji: "👥",
    navLabel: "XI Builder",
    title: "Pavilion XI",
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
    features: ["185 players", "Role filters", "Your figures"],
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
