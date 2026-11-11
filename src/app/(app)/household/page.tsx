import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteForm } from "@/components/household/invite-form";
import { LeaveButton } from "@/components/household/leave-button";
import { PeopleList } from "@/components/household/people-list";
import { EditNotice } from "@/components/inventory/edit-guard";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { getHousehold } from "@/lib/household/members";
import { HOUSEHOLD_MAX_PEOPLE } from "@/lib/household/rules";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Household" };

export default function HouseholdPage() {
  return (
    <section aria-labelledby="household-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <OfflineAwareLink
        href="/settings"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mb-4 -ml-1 inline-flex h-11 w-fit items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-2"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Settings
      </OfflineAwareLink>
      <div className="flex flex-col gap-1">
        <h1
          id="household-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Household
        </h1>
        <p className="text-muted-foreground text-sm">
          Everyone here shares the home's rooms, items, and tasks. Each person has their own
          schedule and calendar, and the work is split by the time each one has.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<HouseholdSkeleton />}>
        <HouseholdSection />
      </Suspense>
    </section>
  );
}

async function HouseholdSection() {
  const [viewer, people] = await Promise.all([getCurrentUser(), getHousehold()]);
  return (
    <>
      {viewer.role === "owner" ? <InviteForm full={people.length >= HOUSEHOLD_MAX_PEOPLE} /> : null}
      <PeopleList people={people} viewer={viewer} />
      {viewer.role === "member" ? (
        <div>
          <LeaveButton />
        </div>
      ) : null}
      <OfflineCacheWarmer urls={["/household"]} version={cacheVersion(people)} />
    </>
  );
}

function HouseholdSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-11 rounded-lg" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
