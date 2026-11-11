"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  clearTimer,
  parseTimers,
  pauseTimer,
  runningTimer,
  startTimer,
  stopTimer,
  type Timers,
} from "@/lib/today/timers";

/** Same-tab notice: the `storage` event only reaches other tabs. */
const CHANGE_EVENT = "mbs:timers-change";

export function timersKey(userId: string): string {
  return `mbs:timer:${userId}`;
}

const noTimers = () => null;

/**
 * This device's task timers (spec 016), shared by every mounted page and tab. `now` ticks once
 * a second only while a timer runs.
 */
export function useTimers(userId: string) {
  const key = timersKey(userId);
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), noTimers);
  const timers = useMemo(() => parseTimers(raw), [raw]);
  const running = runningTimer(timers);

  // Starts at 0 so the server and first client render agree; a paused time doesn't need it.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) {
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const update = useCallback(
    (next: (current: Timers, now: number) => Timers) => {
      const current = parseTimers(localStorage.getItem(key));
      const timers = next(current, Date.now());
      if (Object.keys(timers).length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(timers));
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  const start = useCallback(
    (id: string, date: string) => update((t, at) => startTimer(t, id, date, at)),
    [update],
  );
  const pause = useCallback((id: string) => update((t, at) => pauseTimer(t, id, at)), [update]);
  const clear = useCallback((id: string) => update((t) => clearTimer(t, id)), [update]);
  const stop = useCallback(
    (id: string) => {
      const stopped = stopTimer(parseTimers(localStorage.getItem(key)), id, Date.now());
      if (stopped) {
        update(() => stopped.timers);
      }
      return stopped;
    },
    [key, update],
  );

  return { timers, running, now, start, pause, stop, clear };
}
