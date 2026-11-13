"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useArena, useArenaHydration, type ArenaUser } from "@/store/arena";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ user }: { user: ArenaUser }) {
  return (
    <span
      className={`w-7 h-7 rounded-full bg-gradient-to-br ${user.gradient} flex items-center justify-center text-[11px] font-black text-slate-950 shrink-0`}
      title={`${user.name} ${user.handle}`}
    >
      {initials(user.name)}
    </span>
  );
}

export default function AccountMenu({ email }: { email: string | null }) {
  useArenaHydration();
  const pathname = usePathname();

  const user = useArena((state) => state.user);
  const signOut = useArena((state) => state.signOut);

  if (!user && !email) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/25 transition-all"
      >
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    signOut();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/");
  }

  return (
    <div className="ml-1 flex items-center gap-2 shrink-0">
      <Link
        href="/dashboard"
        className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/40 transition-all whitespace-nowrap"
      >
        Dashboard
      </Link>
      {user && (
        <span className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-700/40">
          <Avatar user={user} />
          <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
            {user.name}
          </span>
        </span>
      )}
      {user?.demo && (
        <span
          className="inline-flex items-center px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[10px] font-bold uppercase tracking-wide text-amber-300 whitespace-nowrap"
          title="This guest view is read-only. Sign in with Google to save your own XIs, matches and takes."
        >
          Guest · read-only
        </span>
      )}
      {!user && email && (
        <span className="hidden lg:inline text-xs text-slate-500 font-mono max-w-[160px] truncate">
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/40 transition-all whitespace-nowrap"
      >
        Sign out
      </button>
    </div>
  );
}
