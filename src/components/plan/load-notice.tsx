import { TriangleAlert } from "lucide-react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { loadLine } from "@/lib/scheduler/format";
import type { LoadSummary } from "@/lib/scheduler/load";

export function LoadNotice({ summary }: { summary: LoadSummary }) {
  if (!summary.overloaded) {
    return <p className="text-muted-foreground text-sm">{loadLine(summary)}</p>;
  }
  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{loadLine(summary)}</p>
        <p>
          Some tasks will run late. Raise a budget or turn on another day in your{" "}
          <OfflineAwareLink
            href="/schedule"
            className="focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
          >
            schedule
          </OfflineAwareLink>
          , or make some{" "}
          <OfflineAwareLink
            href="/tasks"
            className="focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
          >
            tasks
          </OfflineAwareLink>{" "}
          less frequent.
        </p>
      </div>
    </div>
  );
}
