import type { SessionUser } from "@/lib/auth";
import type { StoredBanter } from "@/lib/store";

/** The wall keeps only the most recent posts; older ones roll off. */
export const BANTER_WINDOW = 10;
export const BANTER_MIN_CHARS = 3;
export const BANTER_MAX_CHARS = 240;

export interface BanterPost {
  id: string;
  author: string;
  handle: string;
  gradient: string;
  text: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  own: boolean;
}

/**
 * Tailwind needs whole class strings, so the avatar gradients are a fixed
 * palette indexed by the user id rather than assembled from fragments.
 */
const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-amber-400 to-orange-600",
  "from-fuchsia-400 to-purple-600",
  "from-rose-400 to-red-600",
  "from-lime-400 to-green-600",
  "from-cyan-400 to-blue-600",
  "from-violet-400 to-indigo-600",
];

/**
 * Words the umpire will not allow on the wall. Checked here so the server can
 * enforce it too — a client-side-only filter is a suggestion.
 */
export const FLAGGED = ["fixing", "scam", "abuse", "slur"];

export function flaggedHit(text: string): string | undefined {
  const lower = text.toLowerCase();
  return FLAGGED.find((word) => lower.includes(word));
}

export function cleanBanterText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Collapse whitespace so the length limit means visible characters.
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < BANTER_MIN_CHARS || text.length > BANTER_MAX_CHARS) return null;
  return text;
}

export function authorLabel(email: string): string {
  const local = email.split("@")[0] ?? email;
  const spaced = local
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Anon";
  return spaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 32);
}

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

export function handleFor(userId: string): string {
  return `@${hash(userId).toString(36).slice(0, 6)}`;
}

export function gradientFor(userId: string): string {
  return GRADIENTS[hash(userId) % GRADIENTS.length];
}

/** Oldest-first storage, so the newest entries are the ones that survive. */
export function trimBanter(posts: StoredBanter[]): StoredBanter[] {
  return posts.length <= BANTER_WINDOW
    ? posts
    : posts.slice(posts.length - BANTER_WINDOW);
}

export function displayPosts(
  posts: StoredBanter[],
  viewer: SessionUser | null
): BanterPost[] {
  return posts
    .slice()
    .reverse()
    .map((post) => ({
      id: post.id,
      author: post.author,
      handle: handleFor(post.userId),
      gradient: gradientFor(post.userId),
      text: post.text,
      createdAt: post.createdAt,
      likes: post.likes.length,
      liked: viewer ? post.likes.includes(viewer.id) : false,
      own: viewer ? post.userId === viewer.id : false,
    }));
}
