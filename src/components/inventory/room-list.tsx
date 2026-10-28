import { DoorOpen, Sparkles } from "lucide-react";
import { io } from "next/cache";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheVersion } from "@/lib/cache-version";
import { itemCountLabel } from "@/lib/inventory/format";
import { getRoomFreshness } from "@/lib/inventory/freshness-queries";
import { getRooms } from "@/lib/inventory/queries";
import { FreshnessBadge } from "./freshness-badge";
import { AddRoomButton } from "./room-form";
import { RoomNavLink } from "./room-nav-link";

export async function RoomList() {
  const rooms = await getRooms();
  await io();
  const { rooms: freshness } = await getRoomFreshness(new Date());
  const states = rooms.map((room) => freshness.get(room.id)?.state ?? null);
  const warmer = (
    <OfflineCacheWarmer
      urls={["/rooms", ...rooms.map((room) => `/rooms/${room.id}`)]}
      version={cacheVersion([rooms, states])}
    />
  );

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
        {warmer}
        <DoorOpen aria-hidden className="text-muted-foreground size-8" />
        <h2 className="font-heading text-lg font-semibold">No rooms yet</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Rooms are the spaces of your home, like Kitchen or Bathroom. Add one, then list what's in
          it that needs cleaning.
        </p>
        <AddRoomButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {warmer}
      <ul aria-label="Rooms" className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {rooms.map((room, index) => (
          <li key={room.id}>
            <RoomNavLink href={`/rooms/${room.id}`}>
              <span className="truncate font-medium">
                {room.name}
                <span className="sr-only">,</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <FreshnessBadge state={states[index] ?? null} />
                <span className="sr-only">,</span>
                <span className="text-muted-foreground text-sm">
                  {itemCountLabel(room.itemCount)}
                </span>
              </span>
            </RoomNavLink>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <AddRoomButton variant="outline" />
        <OfflineAwareLink
          href="/tasks/review"
          className={buttonVariants({ size: "lg", className: "h-11" })}
        >
          <Sparkles aria-hidden />
          Propose tasks
        </OfflineAwareLink>
      </div>
    </div>
  );
}

export function RoomListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col divide-y overflow-hidden rounded-xl border">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex min-h-14 items-center justify-between gap-4 px-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
