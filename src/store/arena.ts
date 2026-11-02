"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthProvider = "google" | "github";

export interface ArenaUser {
  id: string;
  name: string;
  handle: string;
  provider: AuthProvider;
  /** Tailwind gradient used for the avatar. */
  gradient: string;
  /** Silenced users can read the wall but not post. */
  silenced: boolean;
  joinedAt: string;
}

interface ArenaState {
  user: ArenaUser | null;
  modalOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signIn: (provider: AuthProvider) => ArenaUser;
  signOut: () => void;
  rename: (name: string) => void;
  /** Mute or unmute the signed-in user on the Banter Wall. */
  setSilenced: (value: boolean) => void;
}

const FIRST = [
  "Vada",
  "Cover",
  "Deep",
  "Silly",
  "Third",
  "Square",
  "Long",
  "Gully",
  "Fine",
  "Mid",
  "Point",
  "Sweep",
];

const LAST = [
  "Pav",
  "Tee",
  "Cope",
  "Maxi",
  "Yorker",
  "Googly",
  "Doosra",
  "Bouncer",
  "Carrom",
  "Reverse",
  "Helicopter",
  "Scoop",
];

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-orange-400 to-red-600",
  "from-sky-400 to-indigo-600",
  "from-fuchsia-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-blue-600",
];

function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `u_${Math.random().toString(36).slice(2, 11)}`;
}

export const useArena = create<ArenaState>()(
  persist(
    (set, get) => ({
      user: null,
      modalOpen: false,
      openAuth: () => set({ modalOpen: true }),
      closeAuth: () => set({ modalOpen: false }),
      signIn: (provider) => {
        const seed = Math.floor(Math.random() * 1000);
        const name = `${pick(FIRST, seed)} ${pick(LAST, seed * 7 + 3)}`;
        const user: ArenaUser = {
          id: makeId(),
          name,
          handle: `@${name.split(" ")[0].toLowerCase()}${seed % 100}`,
          provider,
          gradient: pick(GRADIENTS, seed),
          silenced: false,
          joinedAt: new Date().toISOString(),
        };
        set({ user, modalOpen: false });

        // Mirror the identity onto the server so scoring, squads and history
        // survive a refresh. The request is fire-and-forget on purpose.
        void fetch("/api/auth/demo", { method: "POST" }).catch(() => {});

        return user;
      },
      signOut: () => {
        set({ user: null });
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      },
      rename: (name) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, name } });
      },
      setSilenced: (value) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, silenced: value } });
      },
    }),
    {
      name: "pavilion.arena.user",
      storage: createJSONStorage(() => localStorage),
      // The server has no user, so the first paint is always signed out. The
      // stored identity is rehydrated in an effect to keep hydration stable.
      skipHydration: true,
      partialize: (state) => ({ user: state.user }),
    }
  )
);

/** Rehydrate the persisted identity exactly once, after mount. */
export function useArenaHydration(): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void useArena.persist.rehydrate();
  }, []);
}
