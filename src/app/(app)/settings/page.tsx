import { CalendarCheck, ChevronRight, Clock, House, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { getCalendarConnection } from "@/lib/calendar/queries";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { calendarSummary, homeProfileSummary, scheduleSummary } from "@/lib/settings/summary";
import { getHomeProfile } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <section aria-labelledby="settings-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          id="settings-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">How and when the app plans your cleaning.</p>
      </div>
      <ul
        aria-label="Settings"
        className="flex flex-col divide-y overflow-hidden rounded-xl border"
      >
        <SettingsRow href="/schedule" icon={Clock} title="Schedule">
          <ScheduleLine />
        </SettingsRow>
        <SettingsRow href="/schedule#calendar" icon={CalendarCheck} title="Google Calendar">
          <CalendarLine />
        </SettingsRow>
        <SettingsRow href="/home-profile" icon={House} title="Home profile">
          <HomeProfileLine />
        </SettingsRow>
      </ul>
      <Suspense>
        <SettingsCacheWarmer />
      </Suspense>
    </section>
  );
}

function SettingsRow({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <OfflineAwareLink
        href={href}
        className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-16 items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <Icon aria-hidden className="text-muted-foreground size-5 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-sm">
            <Suspense fallback={<Skeleton aria-hidden className="mt-1 h-4 w-32" />}>
              {children}
            </Suspense>
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </OfflineAwareLink>
    </li>
  );
}

async function ScheduleLine() {
  return scheduleSummary(await getScheduleSettings());
}

async function CalendarLine() {
  return calendarSummary(await getCalendarConnection());
}

async function HomeProfileLine() {
  return homeProfileSummary(await getHomeProfile());
}

async function SettingsCacheWarmer() {
  const [settings, connection, profile] = await Promise.all([
    getScheduleSettings(),
    getCalendarConnection(),
    getHomeProfile(),
  ]);
  return (
    <OfflineCacheWarmer
      urls={["/settings"]}
      version={cacheVersion([settings, connection?.status ?? null, profile])}
    />
  );
}
