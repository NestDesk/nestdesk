"use client";

import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes
const WATCHED_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

export function useIdleTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — proceed to redirect regardless
    }
    window.location.replace("/");
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(signOut, IDLE_TIMEOUT_MS);
  }, [signOut]);

  useEffect(() => {
    resetTimer();
    WATCHED_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true }),
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      WATCHED_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer),
      );
    };
  }, [resetTimer]);
}
