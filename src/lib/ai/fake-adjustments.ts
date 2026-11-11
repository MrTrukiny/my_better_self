import { calibrate } from "@/lib/tasks/calibration";
import { TASK_NAME_MAX } from "@/lib/tasks/limits";
import type { AdjustmentInput, AdjustmentOutput } from "./task-adjustments";

/**
 * Deterministic stand-in for the model, enabled with `AI_FAKE=1` in e2e and CI. It uses the same
 * references as the real prompt, so the same validation runs on its output: a minutes change when
 * the times are off the way calibration measures it, and a deep version of a task with a note.
 * A home note containing "[fail]" makes it throw, to exercise the error path.
 */
export function fakeAdjustmentOutput(input: AdjustmentInput): AdjustmentOutput {
  if (input.homeNote?.includes("[fail]")) {
    throw new Error("Fake AI failure requested by the home note.");
  }
  const suggestions: AdjustmentOutput["suggestions"] = [];
  input.tasks.forEach((task, index) => {
    const ref = `t${index + 1}`;
    const times = task.history.times.map((t) => t.minutes);
    const calibrated = calibrate({ minutes: task.minutes, kind: "cleaning", times });
    if (calibrated) {
      suggestions.push({
        task: ref,
        change: "minutes",
        minutes: calibrated.minutes,
        frequencyDays: null,
        name: null,
        reason: `Your last ${calibrated.samples} times are closer to ${calibrated.minutes} min.`,
      });
    }
    const [note] = task.history.notes;
    if (note) {
      suggestions.push({
        task: ref,
        change: "new_task",
        minutes: 30,
        frequencyDays: 30,
        name: `Deep clean: ${task.name}`.slice(0, TASK_NAME_MAX),
        reason: `Your note "${note.note}" points to an occasional deeper clean.`,
      });
    }
  });
  return { suggestions };
}
