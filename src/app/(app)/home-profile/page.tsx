import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { saveHomeProfile } from "@/app/(app)/tasks/actions";
import { EditNotice } from "@/components/inventory/edit-guard";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { HomeProfileForm } from "@/components/tasks/home-profile-form";
import { TasksCacheWarmer } from "@/components/tasks/tasks-cache-warmer";
import { Skeleton } from "@/components/ui/skeleton";
import { getHomeProfile } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Home profile" };

export default function HomeProfilePage() {
  return (
    <section
      aria-labelledby="home-profile-heading"
      className="mx-auto flex max-w-2xl flex-col gap-6"
    >
      <OfflineAwareLink
        href="/settings"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mb-4 -ml-1 inline-flex h-11 w-fit items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-2"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Settings
      </OfflineAwareLink>
      <div className="flex flex-col gap-1">
        <h1
          id="home-profile-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Home profile
        </h1>
        <p className="text-muted-foreground text-sm">
          Tell the AI how your home works, so its task proposals fit how you clean.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<HomeProfileSkeleton />}>
        <HomeProfileSection />
      </Suspense>
      <Suspense>
        <TasksCacheWarmer />
      </Suspense>
    </section>
  );
}

async function HomeProfileSection() {
  const profile = await getHomeProfile();
  return <HomeProfileForm action={saveHomeProfile} profile={profile} />;
}

function HomeProfileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-4 w-20" />
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-11 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}
