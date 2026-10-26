import { Coffee, Repeat, TriangleAlert } from "lucide-react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { dayLabel, type PlanDayView, planTarget } from "@/lib/scheduler/format";
import { formatMinutes } from "@/lib/tasks/format";
import { cn } from "@/lib/utils";

/** `overlap`: the session overlaps a busy time in the owner's other calendars (spec 005). */
export function PlanDay({ day, overlap = false }: { day: PlanDayView; overlap?: boolean }) {
  const headingId = `day-${day.date}`;
  const label = dayLabel(day.date);
  return (
    <article
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3 rounded-xl border p-4", day.isToday && "border-primary")}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="font-heading flex items-center gap-2 text-base font-semibold">
          {day.isToday ? (
            <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-xs">
              Today
            </span>
          ) : null}
          {label}
        </h2>
        {day.off ? (
          <p className="text-muted-foreground text-sm">Day off</p>
        ) : day.cleaning.length > 0 ? (
          <p className="text-muted-foreground text-sm tabular-nums">
            {day.start}–{day.end} · {day.total} of {day.budget} min
          </p>
        ) : null}
      </header>

      {day.off ? null : day.cleaning.length > 0 ? (
        <ul aria-label={`Cleaning on ${label}`} className="flex flex-col divide-y">
          {day.cleaning.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-base">{task.name}</span>
                <span className="text-muted-foreground text-sm">{planTarget(task)}</span>
              </div>
              <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                {formatMinutes(task.minutes)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Coffee aria-hidden className="size-4 shrink-0" />
          Nothing to clean, enjoy the day.
        </p>
      )}

      {overlap && !day.off && day.cleaning.length > 0 ? (
        <p className="flex items-start gap-2 text-sm">
          <TriangleAlert
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <span>
            Overlaps another event in your calendar ({day.start}–{day.end}).{" "}
            <OfflineAwareLink
              href="/schedule"
              className="focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
            >
              Change the start time
            </OfflineAwareLink>
          </span>
        </p>
      ) : null}

      {day.routines.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Repeat aria-hidden className="size-4 shrink-0" />
            {day.isToday ? "Also today" : "Also this day"}
          </h3>
          <ul aria-label={`Routines on ${label}`} className="flex flex-wrap gap-2">
            {day.routines.map((task) => (
              <li key={task.id} className="bg-muted rounded-md px-2 py-1 text-sm">
                {task.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
