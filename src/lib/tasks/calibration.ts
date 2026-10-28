import { minutesMax, type TaskKind } from "./limits";

/** Spec 011 and ADR 0009. */
export const CALIBRATION = {
  /** Recorded times needed before an estimate changes. */
  minSamples: 3,
  /** How many of the latest times the median looks at. */
  window: 5,
  /** A change is kept when it is at least this many minutes... */
  minChangeMinutes: 2,
  /** ...or at least this share of the current estimate. */
  minChangeShare: 0.2,
} as const;

/**
 * The calibrated estimate from a task's recorded times since its baseline, newest first, or null
 * when the estimate should stay as it is.
 */
export function calibrate({
  minutes,
  kind,
  times,
}: {
  minutes: number;
  kind: TaskKind;
  times: readonly number[];
}): { minutes: number; samples: number } | null {
  if (kind !== "cleaning" || times.length < CALIBRATION.minSamples) {
    return null;
  }
  const recent = times.slice(0, CALIBRATION.window);
  const target = Math.min(Math.max(Math.round(median(recent)), 1), minutesMax(kind));
  const change = Math.abs(target - minutes);
  if (change < CALIBRATION.minChangeMinutes && change < minutes * CALIBRATION.minChangeShare) {
    return null;
  }
  return target === minutes ? null : { minutes: target, samples: recent.length };
}

export function calibrationNote({
  from,
  minutes,
  samples,
}: {
  from: number;
  minutes: number;
  samples: number;
}): string {
  return `Adjusted from ${from} to ${minutes} min from your last ${samples} times`;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
