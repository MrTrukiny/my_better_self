import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { EditNotice } from "@/components/inventory/edit-guard";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { NoScheduleState, NoTasksState } from "@/components/plan/empty-state";
import { LoadNotice } from "@/components/plan/load-notice";
import { PlanDay } from "@/components/plan/plan-day";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { buildWeek } from "@/lib/scheduler/format";
import { loadSummary } from "@/lib/scheduler/load";
import { getPlanWeek, getScheduleSettings } from "@/lib/scheduler/queries";
import { PLAN_DAYS, WEEKDAYS } from "@/lib/scheduler/settings";
import { getTasks } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Plan" };

/** Pages whose offline copies show the plan or its settings. */
const PLAN_PAGES = ["/plan", "/schedule", "/"];

const linkClass =
  "text-foreground focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2";

export default function PlanPage() {
  return (
    <section aria-labelledby="plan-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          id="plan-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Your week
        </h1>
        <p className="text-muted-foreground text-sm">
          What you'll clean each day, within your daily minutes.{" "}
          <OfflineAwareLink href="/schedule" className={linkClass}>
            Schedule
          </OfflineAwareLink>
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<PlanSkeleton />}>
        <PlanSection />
      </Suspense>
    </section>
  );
}

async function PlanSection() {
  const [settings, tasks] = await Promise.all([getScheduleSettings(), getTasks()]);
  if (!settings) {
    return (
      <>
        <NoScheduleState />
        <OfflineCacheWarmer urls={PLAN_PAGES} version={cacheVersion(["no-schedule", tasks])} />
      </>
    );
  }
  if (!tasks.some((t) => t.kind === "cleaning")) {
    return (
      <>
        <NoTasksState />
        <OfflineCacheWarmer urls={PLAN_PAGES} version={cacheVersion([settings, tasks])} />
      </>
    );
  }

  await io();
  const { today, occurrences } = await getPlanWeek(settings, new Date());
  const week = buildWeek(settings, occurrences, today);
  return (
    <div className="flex flex-col gap-4">
      <LoadNotice summary={loadSummary(tasks, settings)} />
      <ol aria-label="Next 7 days" className="flex flex-col gap-3">
        {week.map((day) => (
          <li key={day.date}>
            <PlanDay day={day} />
          </li>
        ))}
      </ol>
      <OfflineCacheWarmer urls={PLAN_PAGES} version={cacheVersion([settings, week])} />
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-4 w-72" />
      {WEEKDAYS.slice(0, PLAN_DAYS).map((weekday) => (
        <Skeleton key={weekday} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
