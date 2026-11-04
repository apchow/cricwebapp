"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Heart, Lock, Send, ShieldAlert, Sparkles, Trash2 } from "lucide-react";

import ToolHeader from "@/components/tool-header";
import { flaggedHit } from "@/lib/banter";
import { useToast } from "@/lib/client";
import { useArena, useArenaHydration } from "@/store/arena";

/** The wall is a rolling window, so the page refreshes itself periodically. */
const REFRESH_MS = 30_000;
const MAX_LEN = 220;
const SILENCED_BADGE = "Paid to Cope";

export interface Post {
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

  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/banter", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { posts: Post[] };
        if (cancelled) return;
        setPosts(data.posts);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const ordered = useMemo(() => {
    const list = [...posts];
    if (sort === "top") return list.sort((a, b) => b.likes - a.likes);
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [posts, sort]);

  const silenced = user?.silenced ?? false;
  const remaining = MAX_LEN - draft.length;

  async function toggleLike(id: string) {
    if (!user) {
      openAuth();
      return;
    }
    try {
      const response = await fetch("/api/banter/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; posts?: Post[] }
        | null;
      if (!response.ok || !data?.posts) {
        notify(data?.error ?? "Could not reach the wall");
        return;
      }
      setPosts(data.posts);
    } catch {
      notify("Could not reach the wall");
    }
  }

  async function remove(id: string) {
    try {
      const response = await fetch(`/api/banter/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; posts?: Post[] }
        | null;
      if (!response.ok || !data?.posts) {
        notify(data?.error ?? "Could not remove that take");
        return;
      }
      setPosts(data.posts);
      notify("Post removed");
    } catch {
      notify("Could not reach the wall");
    }
  }

  async function post() {
    if (!user) {
      openAuth();
      return;
    }
    const text = draft.trim();
    if (!text) {
      notify("Say something first");
      return;
    }
    const hit = flaggedHit(text);
    if (hit) {
      setSilenced(true);
      notify("Silenced — that one crossed the line");
      return;
    }
    setDraft("");
    try {
      const response = await fetch("/api/banter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; posts?: Post[] }
        | null;
      if (!response.ok || !data?.posts) {
        setDraft(text);
        notify(data?.error ?? "Could not reach the wall");
        return;
      }
      setPosts(data.posts);
      notify("Posted to the wall");
    } catch {
      setDraft(text);
      notify("Could not reach the wall");
    }
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
              latest {posts.length} {posts.length === 1 ? "take" : "takes"}
            </span>
          </div>

          {failed && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
              The wall is unreachable right now — showing the last posts it sent.
            </p>
          )}

          {ready && !failed && ordered.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2">🏟️</div>
              <p className="text-sm text-slate-300 font-semibold">
                Empty arena
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Nobody has said anything yet. Be the first take on the wall.
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {ordered.map((entry) => (
              <motion.article
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className="glass rounded-2xl p-5"
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
                      <span className="text-xs text-slate-600 ml-auto">
                        {/* Wall-clock text is only rendered after mount so the
                            server and client trees always agree. */}
                        {ready ? timeAgo(entry.createdAt) : null}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-200">
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
