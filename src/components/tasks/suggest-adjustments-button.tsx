"use client";

import type { GenerateState } from "@/lib/tasks/generate-state";
import { GenerateButton, type GenerateCopy } from "./generate-button";

const COPY: GenerateCopy = {
  label: "Suggest adjustments",
  progress: [
    { after: 0, text: "Reading your times and notes..." },
    { after: 2_000, text: "Reviewing your tasks..." },
    { after: 20_000, text: "Still working. This can take up to a minute..." },
  ],
  result: (count) =>
    count === 0
      ? "Your tasks match your times. Nothing to adjust."
      : `${count} ${count === 1 ? "adjustment" : "adjustments"} suggested.`,
};

export function SuggestAdjustmentsButton({
  action,
  unavailableReason,
}: {
  action: () => Promise<GenerateState>;
  unavailableReason?: string;
}) {
  return <GenerateButton action={action} copy={COPY} unavailableReason={unavailableReason} />;
}
