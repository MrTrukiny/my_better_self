import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  removeSubscription,
  saveNotificationPrefs,
  saveSubscription,
} from "@/app/(app)/notifications/actions";
import { EditNotice } from "@/components/inventory/edit-guard";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { vapidPublicKey } from "@/lib/notifications/config";
import { getNotificationPrefs, isDeviceSubscribed } from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <section
      aria-labelledby="notifications-heading"
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
          id="notifications-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Notifications
        </h1>
        <p className="text-muted-foreground text-sm">
          Reminders on this device, besides your calendar. Times follow your schedule's time zone.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<Skeleton aria-hidden className="h-32 rounded-xl" />}>
        <NotificationsSection />
      </Suspense>
    </section>
  );
}

async function NotificationsSection() {
  const [prefs, subscribed] = await Promise.all([getNotificationPrefs(), isDeviceSubscribed()]);
  const publicKey = vapidPublicKey();
  return (
    <>
      {publicKey ? (
        <NotificationsPanel
          publicKey={publicKey}
          subscribed={subscribed}
          prefs={prefs}
          subscribe={saveSubscription}
          unsubscribe={removeSubscription}
          savePrefs={saveNotificationPrefs}
        />
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          Notifications aren't set up for this app yet.
        </p>
      )}
      <OfflineCacheWarmer
        urls={["/notifications", "/settings"]}
        version={cacheVersion([prefs, subscribed])}
      />
    </>
  );
}
