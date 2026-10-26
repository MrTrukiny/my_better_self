import type { Metadata } from "next";
import { Suspense } from "react";
import { saveSchedule } from "@/app/(app)/schedule/actions";
import { EditNotice } from "@/components/inventory/edit-guard";
import { ScheduleForm } from "@/components/plan/schedule-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { defaultSettings, WEEKDAYS } from "@/lib/scheduler/settings";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
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
    </section>
  );
}

async function ScheduleSection() {
  const { timeZone: _, ...settings } = (await getScheduleSettings()) ?? defaultSettings("UTC");
  return <ScheduleForm action={saveSchedule} settings={settings} />;
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
