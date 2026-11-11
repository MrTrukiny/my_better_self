import { groupByTarget } from "@/lib/tasks/format";
import type { PendingAdjustment } from "@/lib/tasks/queries";
import { AdjustmentCard } from "./adjustment-card";

export function AdjustmentList({
  adjustments,
  roomOrder,
}: {
  adjustments: PendingAdjustment[];
  roomOrder: string[];
}) {
  if (adjustments.length === 0) {
    return null;
  }
  const groups = groupByTarget(adjustments, roomOrder);
  return (
    <section aria-labelledby="adjustments-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="adjustments-heading" className="font-heading text-lg font-semibold">
          Pending adjustments
        </h2>
        <p className="text-muted-foreground text-sm">
          Nothing changes until you accept it. Pending adjustments wait here if you leave.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-2">
          <h3 id={`adjustments-${group.id}`} className="text-sm font-medium">
            {group.title}
          </h3>
          <ul
            aria-labelledby={`adjustments-${group.id}`}
            className="flex flex-col divide-y overflow-hidden rounded-xl border"
          >
            {group.entries.map((adjustment) => (
              <AdjustmentCard key={adjustment.id} adjustment={adjustment} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
