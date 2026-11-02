"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Read a string from localStorage, tolerating private-mode / disabled storage. */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Persist a string to localStorage, ignoring quota or permission failures. */
export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

/**
 * Transient status message with its own timer. Every screen that confirms an
 * action (saving an XI, deleting a match, copying to the clipboard) uses this
 * instead of keeping its own ref + setTimeout pair.
 */
export function useToast(timeoutMs = 2600) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (next: string) => {
      setMessage(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { message, notify };
}
