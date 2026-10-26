import { ListChecks, Sparkles } from "lucide-react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DAILY_CLEANING_MINUTES } from "@/lib/app-config";
import { dailyMinutes, groupByTarget } from "@/lib/tasks/format";
import type { TaskEntry } from "@/lib/tasks/queries";
import { TaskRow } from "./task-row";

function TaskGroupList({ id, title, tasks }: { id: string; title: string; tasks: TaskEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 id={id} className="text-sm font-medium">
        {title}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
    </div>
  );
}

export function TaskList({ tasks, roomOrder }: { tasks: TaskEntry[]; roomOrder: string[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
        <ListChecks aria-hidden className="text-muted-foreground size-8" />
        <h2 className="font-heading text-lg font-semibold">No tasks yet</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Let the AI propose tasks from your inventory, then keep the ones that fit.
        </p>
        <Button
          size="lg"
          className="h-11"
          render={<OfflineAwareLink href="/tasks/review" />}
          nativeButton={false}
        >
          <Sparkles aria-hidden />
          Propose tasks
        </Button>
      </div>
    );
  }

  const cleaning = tasks.filter((task) => task.kind === "cleaning");
  const routines = tasks.filter((task) => task.kind === "routine");
  const cleaningPerDay = dailyMinutes(cleaning);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">
        About {cleaningPerDay} min of cleaning a day (budget {DAILY_CLEANING_MINUTES} min)
        {routines.length > 0 ? ` and ${dailyMinutes(routines)} min of routines` : ""}, on average.
      </p>
      {cleaning.length > 0 ? (
        <section aria-labelledby="cleaning-heading" className="flex flex-col gap-4">
          <h2 id="cleaning-heading" className="font-heading text-lg font-semibold">
            Cleaning tasks
          </h2>
          {groupByTarget(cleaning, roomOrder).map((group) => (
            <TaskGroupList
              key={group.id}
              id={`cleaning-${group.id}`}
              title={group.title}
              tasks={group.entries}
            />
          ))}
        </section>
      ) : null}
      {routines.length > 0 ? (
        <section aria-labelledby="routines-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="routines-heading" className="font-heading text-lg font-semibold">
              Routines
            </h2>
            <p className="text-muted-foreground text-sm">
              Habits tracked outside the daily cleaning time.
            </p>
          </div>
          {groupByTarget(routines, roomOrder).map((group) => (
            <TaskGroupList
              key={group.id}
              id={`routines-${group.id}`}
              title={group.title}
              tasks={group.entries}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex min-h-16 flex-col justify-center gap-2 px-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
