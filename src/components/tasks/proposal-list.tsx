import { groupByTarget } from "@/lib/tasks/format";
import type { TaskEntry } from "@/lib/tasks/queries";
import { AcceptAllBar, ProposalCard } from "./proposal-card";

export function ProposalList({
  proposals,
  roomOrder,
}: {
  proposals: TaskEntry[];
  roomOrder: string[];
}) {
  if (proposals.length === 0) {
    return null;
  }
  const groups = groupByTarget(proposals, roomOrder);
  return (
    <section aria-labelledby="proposals-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="proposals-heading" className="font-heading text-lg font-semibold">
          Pending proposals
        </h2>
        <p className="text-muted-foreground text-sm">
          Nothing is added until you accept it. Pending proposals wait here if you leave.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-2">
          <h3 id={`proposals-${group.id}`} className="text-sm font-medium">
            {group.title}
          </h3>
          <ul
            aria-labelledby={`proposals-${group.id}`}
            className="flex flex-col divide-y overflow-hidden rounded-xl border"
          >
            {group.entries.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </ul>
        </div>
      ))}
      <AcceptAllBar count={proposals.length} />
    </section>
  );
}
