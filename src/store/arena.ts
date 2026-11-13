"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

import { authorLabel, gradientFor, handleFor } from "@/lib/banter";

export interface ArenaUser {
  id: string;
  name: string;
  handle: string;
  gradient: string;
  /** Silenced users can read the wall but not post. */
  silenced: boolean;
  /** The shared look-around account: reads everything, writes nothing. */
  demo: boolean;
}

interface ArenaState {
  user: ArenaUser | null;
  /** False until the server has answered who this is. */
  checked: boolean;
  modalOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signOut: () => void;
  /** Mute or unmute the signed-in user on the Banter Wall. */
  setSilenced: (value: boolean) => void;
  syncFromServer: () => Promise<void>;
}

interface ServerUser {
  id: string;
  email: string;
  demo?: boolean;
}

const SILENCED_KEY = "pundit.silenced.v1";

function silencedIds(): string[] {
  try {
    const raw = localStorage.getItem(SILENCED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberSilenced(id: string, value: boolean): void {
  try {
    const others = silencedIds().filter((entry) => entry !== id);
    localStorage.setItem(
      SILENCED_KEY,
      JSON.stringify(value ? [...others, id] : others)
    );
  } catch {
    /* private mode: the silence just does not persist */
  }
}

/**
 * Identity comes from the session cookie, never from a locally minted persona.
 * The old store invented a random name in the browser, so the wall attributed
 * posts to one shared demo account while the UI showed a made-up handle.
 */
export const useArena = create<ArenaState>()((set, get) => ({
  user: null,
  checked: false,
  modalOpen: false,
  openAuth: () => set({ modalOpen: true }),
  closeAuth: () => set({ modalOpen: false }),
  signOut: () => {
    set({ user: null, checked: true });
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  },
  setSilenced: (value) => {
    const current = get().user;
    if (!current) return;
    rememberSilenced(current.id, value);
    set({ user: { ...current, silenced: value } });
  },
  syncFromServer: async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        user?: ServerUser | null;
      } | null;
      const serverUser = data?.user ?? null;
      if (!serverUser) {
        set({ user: null, checked: true });
        return;
      }
      set({
        user: {
          id: serverUser.id,
          name: authorLabel(serverUser.email),
          handle: handleFor(serverUser.id),
          gradient: gradientFor(serverUser.id),
          silenced: silencedIds().includes(serverUser.id),
          demo: serverUser.demo ?? false,
        },
        checked: true,
      });
    } catch {
      set({ checked: true });
    }
  },
}));

/** Ask the server who this visitor is, once per mount. */
export function useArenaHydration(): void {
  const syncFromServer = useArena((state) => state.syncFromServer);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void syncFromServer();
  }, [syncFromServer]);
}
