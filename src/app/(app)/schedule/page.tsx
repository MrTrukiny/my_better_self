import type { Metadata } from "next";
import { Suspense } from "react";
import { saveSchedule } from "@/app/(app)/schedule/actions";
import { disconnectCalendar } from "@/app/(app)/schedule/calendar-actions";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { EditNotice } from "@/components/inventory/edit-guard";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { ScheduleForm } from "@/components/plan/schedule-form";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { isCalendarFake } from "@/lib/calendar/client";
import { getCalendarConnection } from "@/lib/calendar/queries";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { defaultSettings, WEEKDAYS } from "@/lib/scheduler/settings";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <section aria-labelledby="schedule-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          id="schedule-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Schedule
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose when you clean. Mornings tend to work best. The plan never goes over these minutes.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleSection />
      </Suspense>
      <Suspense fallback={<Skeleton aria-hidden className="h-32 rounded-xl" />}>
        <CalendarArea searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ScheduleSection() {
  const saved = await getScheduleSettings();
  const { timeZone: _, ...settings } = saved ?? defaultSettings("UTC");
  return (
    <>
      <ScheduleForm action={saveSchedule} settings={settings} />
      <OfflineCacheWarmer urls={["/schedule", "/plan"]} version={cacheVersion(saved)} />
    </>
  );
}

async function CalendarArea({ searchParams }: Pick<PageProps<"/schedule">, "searchParams">) {
  const [{ calendar }, user, connection] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getCalendarConnection(),
  ]);
  return (
    <CalendarSection
      connection={connection}
      denied={calendar === "denied"}
      fake={isCalendarFake()}
      email={user.email}
      disconnect={disconnectCalendar}
    />
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      {WEEKDAYS.map((weekday) => (
        <Skeleton key={weekday} className="h-11 rounded-lg" />
      ))}
    </div>
  );
}
