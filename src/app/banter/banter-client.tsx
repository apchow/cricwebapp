"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Heart, Lock, Send, ShieldAlert, Sparkles, Trash2 } from "lucide-react";

import ToolHeader from "@/components/tool-header";
import { readLocal, writeLocal, useToast } from "@/lib/client";
import { useArena, useArenaHydration } from "@/store/arena";

const STORE_KEY = "pavilion.banter.v16";
const MAX_LEN = 220;
const SILENCED_BADGE = "Paid to Cope";

/** Words the umpire will not allow on the wall. */
const FLAGGED = ["fixing", "scam", "abuse", "slur"];

export interface Post {
  id: string;
  author: string;
  handle: string;
  gradient: string;
  text: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  silenced: boolean;
  own: boolean;
}

const now = Date.now();
const minutes = (value: number) => new Date(now - value * 60_000).toISOString();

const SEED: Post[] = [
  {
    id: "seed-1",
    author: "Cover Drive Carl",
    handle: "@covercarl",
    gradient: "from-emerald-400 to-teal-600",
    text: "Two uncapped, four capped. If you cannot name them without checking a spreadsheet you are not ready for retention night.",
    createdAt: minutes(14),
    likes: 42,
    liked: false,
    silenced: false,
    own: false,
  },
  {
    id: "seed-2",
    author: "Long On Larry",
    handle: "@longonlarry",
    gradient: "from-orange-400 to-red-600",
    text: "Called it in March. Called it in April. Called it again tonight. I am never wrong, I am just early.",
    createdAt: minutes(52),
    likes: 18,
    liked: false,
    silenced: false,
    own: false,
  },
  {
    id: "seed-3",
    author: "Deep Midwicket",
    handle: "@deepmid",
    gradient: "from-sky-400 to-indigo-600",
    text: "That was never a six. The rope is two feet in. Do the maths.",
    createdAt: minutes(96),
    likes: 7,
    liked: false,
    silenced: false,
    own: false,
  },
  {
    id: "seed-4",
    author: "Silly Point Sam",
    handle: "@sillysam",
    gradient: "from-amber-400 to-orange-600",
    text: "I HAVE BEEN SAYING THIS FOR NINE YEARS AND NOBODY LISTENS TO ME EVER",
    createdAt: minutes(140),
    likes: 3,
    liked: false,
    silenced: true,
    own: false,
  },
  {
    id: "seed-5",
    author: "Googly Gang",
    handle: "@googlygang",
    gradient: "from-fuchsia-400 to-purple-600",
    text: "Spinner on a turning deck, keeper up, one slip. Some of you have never captained a gully match and it shows.",
    createdAt: minutes(210),
    likes: 61,
    liked: false,
    silenced: false,
    own: false,
  },
  {
    id: "seed-6",
    author: "Third Man Ted",
    handle: "@thirdmanted",
    gradient: "from-cyan-400 to-blue-600",
    text: "Retention is just a polite way of saying you are scared of the auction.",
    createdAt: minutes(320),
    likes: 27,
    liked: false,
    silenced: false,
    own: false,
  },
];

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Math.random().toString(36).slice(2, 11)}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function load(): Post[] {
  const raw = readLocal(STORE_KEY);
  if (!raw) return SEED;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return SEED;
    const clean = parsed.filter(
      (item): item is Post =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Post).id === "string" &&
        typeof (item as Post).text === "string"
    );
    return [...clean, ...SEED.filter((seed) => !clean.some((post) => post.id === seed.id))];
  } catch {
    return SEED;
  }
}

export function PaidToCopeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300 ${className}`}
      title="Silenced by the umpires"
    >
      <ShieldAlert className="w-3 h-3" />
      {SILENCED_BADGE}
    </span>
  );
}

export default function BanterWall() {
  useArenaHydration();

  const user = useArena((state) => state.user);
  const openAuth = useArena((state) => state.openAuth);
  const setSilenced = useArena((state) => state.setSilenced);
  const { message, notify } = useToast();

  const [posts, setPosts] = useState<Post[]>(SEED);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPosts(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeLocal(STORE_KEY, JSON.stringify(posts));
  }, [posts, ready]);

  const ordered = useMemo(() => {
    const list = [...posts];
    if (sort === "top") return list.sort((a, b) => b.likes - a.likes);
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [posts, sort]);

  const silenced = user?.silenced ?? false;
  const remaining = MAX_LEN - draft.length;

  function toggleLike(id: string) {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post
      )
    );
  }

  function remove(id: string) {
    setPosts((prev) => prev.filter((post) => post.id !== id));
    notify("Post removed");
  }

  function post() {
    if (!user) {
      openAuth();
      return;
    }
    const text = draft.trim();
    if (!text) {
      notify("Say something first");
      return;
    }
    const hit = FLAGGED.find((word) => text.toLowerCase().includes(word));
    if (hit) {
      setSilenced(true);
      notify("Silenced — that one crossed the line");
      return;
    }
    const entry: Post = {
      id: makeId(),
      author: user.name,
      handle: user.handle,
      gradient: user.gradient,
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      liked: false,
      silenced: false,
      own: true,
    };
    setPosts((prev) => [entry, ...prev]);
    setDraft("");
    notify("Posted to the wall");
  }

  return (
    <>
      <ToolHeader
        eyebrow="The Group Chat"
        title="Banter Wall"
        blurb="Hot takes, cold takes and everything in between. Post your reaction, drop a like, and try not to get silenced."
        gradient="from-fuchsia-300 via-purple-200 to-indigo-300"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6 items-start">
        <div className="space-y-5">
          <div className="glass rounded-3xl p-5">
            {!user ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-bold mb-0.5">Got a take?</div>
                  <p className="text-sm text-slate-400">
                    Sign in and the wall is yours. Takes one tap.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAuth}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-fuchsia-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Sign in to post
                </button>
              </div>
            ) : silenced ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-red-400" />
                    <span className="font-bold text-red-300">You are silenced</span>
                    <PaidToCopeBadge />
                  </div>
                  <p className="text-sm text-slate-400">
                    You can still read the wall, but the megaphone is with the umpires.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSilenced(false);
                    notify("Appeal upheld — you are back");
                  }}
                  className="shrink-0 rounded-xl px-5 py-3 font-bold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 transition-all"
                >
                  Appeal the decision
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <span
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${user.gradient} flex items-center justify-center text-xs font-black text-slate-950 shrink-0`}
                >
                  {initials(user.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, MAX_LEN))}
                    rows={2}
                    placeholder="Drop your take…"
                    className="w-full resize-none rounded-xl bg-slate-900/70 border border-slate-700/60 focus:border-fuchsia-500/60 outline-none px-4 py-3 text-sm placeholder:text-slate-500 transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2 gap-3">
                    <span
                      className={`text-[11px] font-mono ${
                        remaining < 30 ? "text-amber-400" : "text-slate-500"
                      }`}
                    >
                      {remaining} left
                    </span>
                    <button
                      type="button"
                      onClick={post}
                      disabled={draft.trim().length === 0}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100"
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(["new", "top"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSort(option)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  sort === option
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {option === "new" ? "Newest" : "Top"}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {ordered.map((entry) => (
              <motion.article
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className={`glass rounded-2xl p-5 ${
                  entry.silenced ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${entry.gradient} flex items-center justify-center text-xs font-black text-slate-950 shrink-0`}
                  >
                    {initials(entry.author)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold text-sm">{entry.author}</span>
                      <span className="text-xs text-slate-500">{entry.handle}</span>
                      {entry.own && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">
                          you
                        </span>
                      )}
                      {entry.silenced && <PaidToCopeBadge />}
                      <span className="text-xs text-slate-600 ml-auto">
                        {/* Wall-clock text is only rendered after mount so the
                            server and client trees always agree. */}
                        {ready ? timeAgo(entry.createdAt) : null}
                      </span>
                    </div>
                    <p
                      className={`mt-2 text-sm leading-relaxed ${
                        entry.silenced ? "text-slate-500 line-through" : "text-slate-200"
                      }`}
                    >
                      {entry.text}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleLike(entry.id)}
                        aria-pressed={entry.liked}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                          entry.liked
                            ? "bg-red-500/15 text-red-300 border border-red-500/40"
                            : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <Heart
                          className="w-3.5 h-3.5"
                          fill={entry.liked ? "currentColor" : "none"}
                        />
                        {entry.likes}
                      </button>
                      {entry.own && (
                        <button
                          type="button"
                          onClick={() => remove(entry.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
                House rules
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <li>Take the mickey out of the take, not the person.</li>
              <li>No betting talk, no fixing talk. Instant silence.</li>
              <li>Three takes an over is plenty.</li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mb-2">
              Your status
            </div>
            {!user ? (
              <p className="text-xs text-slate-400">
                Anonymous. Sign in to post and react.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${user.gradient} flex items-center justify-center text-[10px] font-black text-slate-950`}
                  >
                    {initials(user.name)}
                  </span>
                  <span className="text-sm font-semibold truncate">{user.name}</span>
                </div>
                {user.silenced ? (
                  <PaidToCopeBadge />
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                    In good standing
                  </span>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] glass rounded-xl px-5 py-3 text-sm font-semibold shadow-xl"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
