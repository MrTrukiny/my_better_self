import { History } from "lucide-react";
import { io } from "next/cache";
import { Suspense } from "react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { NoScheduleState, NoTasksState } from "@/components/plan/empty-state";
import { TodaySession } from "@/components/today/today-session";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { toIsoDate } from "@/lib/scheduler/dates";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { budgetFor, startTimeFor } from "@/lib/scheduler/settings";
import { getCurrentUser } from "@/lib/session";
import { getTasks } from "@/lib/tasks/queries";
import { uncheckedDays } from "@/lib/today/earlier";
import { getToday } from "@/lib/today/queries";
import { streakOf } from "@/lib/today/streak";
import { setOccurrenceStatus } from "./actions";

const NO_COUNTS = { total: 0, done: 0, skipped: 0 };

const linkClass =
  "text-foreground focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2";

export default function TodayPage() {
  return (
    <section aria-labelledby="today-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1
          id="today-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Today
        </h1>
        <OfflineAwareLink href="/plan" className={`${linkClass} text-sm`}>
          See your week
        </OfflineAwareLink>
      </div>
      <Suspense fallback={<TodaySkeleton />}>
        <TodaySection />
      </Suspense>
    </section>
  );
}

async function TodaySection() {
  const [user, settings, tasks] = await Promise.all([
    getCurrentUser(),
    getScheduleSettings(),
    getTasks(),
  ]);
  if (!settings) {
    return (
      <>
        <NoScheduleState />
        <OfflineCacheWarmer urls={["/"]} version={cacheVersion(["no-schedule", tasks])} />
      </>
    );
  }
  if (!tasks.some((t) => t.kind === "cleaning")) {
    return (
      <>
        <NoTasksState />
        <OfflineCacheWarmer urls={["/"]} version={cacheVersion([settings, tasks])} />
      </>
    );
  }

  await io();
  const { today, tasks: todayTasks, history } = await getToday(settings, new Date());
  const unchecked = uncheckedDays(history, today);
  return (
    <>
      <TodaySession
        userId={user.id}
        date={toIsoDate(today)}
        timeZone={settings.timeZone}
        start={startTimeFor(settings, today)}
        budget={budgetFor(settings, today)}
        tasks={todayTasks}
        pastStreak={streakOf(history, today, NO_COUNTS)}
        version={cacheVersion([settings, todayTasks])}
        send={setOccurrenceStatus}
      />
      <OfflineAwareLink
        href="/earlier-days"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex h-11 w-fit items-center gap-2 rounded-md px-1 text-sm outline-none focus-visible:ring-2"
      >
        <History aria-hidden className="size-4" />
        Earlier days
        {unchecked > 0 ? <span className="tabular-nums">· {unchecked} unchecked</span> : null}
      </OfflineAwareLink>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
