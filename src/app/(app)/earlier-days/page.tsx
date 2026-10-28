import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { EarlierDays } from "@/components/today/earlier-days";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { toIsoDate } from "@/lib/scheduler/dates";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { getCurrentUser } from "@/lib/session";
import { getEarlierDays } from "@/lib/today/queries";
import { setOccurrenceStatus } from "../actions";

export const metadata: Metadata = { title: "Earlier days" };

export default function EarlierDaysPage() {
  return (
    <section aria-labelledby="earlier-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <OfflineAwareLink
        href="/"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mb-4 -ml-1 inline-flex h-11 w-fit items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-2"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Today
      </OfflineAwareLink>
      <div className="flex flex-col gap-1">
        <h1
          id="earlier-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Earlier days
        </h1>
        <p className="text-muted-foreground text-sm">
          Check off what you did in the last week. The plan adjusts to it.
        </p>
      </div>
      <Suspense fallback={<EarlierSkeleton />}>
        <EarlierSection />
      </Suspense>
    </section>
  );
}

async function EarlierSection() {
  const [user, settings] = await Promise.all([getCurrentUser(), getScheduleSettings()]);
  if (!settings) {
    return (
      <EarlierDays
        userId={user.id}
        timeZone="UTC"
        days={[]}
        version="no-schedule"
        send={setOccurrenceStatus}
      />
    );
  }
  await io();
  const { days } = await getEarlierDays(settings, new Date());
  const props = days.map(({ day, ...rest }) => ({ date: toIsoDate(day), ...rest }));
  return (
    <EarlierDays
      userId={user.id}
      timeZone={settings.timeZone}
      days={props}
      version={cacheVersion([settings, props])}
      send={setOccurrenceStatus}
    />
  );
}

function EarlierSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
