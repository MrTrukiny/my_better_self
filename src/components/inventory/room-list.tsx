import { DoorOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { itemCountLabel } from "@/lib/inventory/format";
import { getRooms } from "@/lib/inventory/queries";
import { OfflineCacheWarmer } from "./offline-cache-warmer";
import { AddRoomButton } from "./room-form";
import { RoomNavLink } from "./room-nav-link";

export async function RoomList() {
  const rooms = await getRooms();
  const warmer = (
    <OfflineCacheWarmer
      urls={["/rooms", ...rooms.map((room) => `/rooms/${room.id}`)]}
      version={JSON.stringify(rooms)}
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
        {rooms.map((room) => (
          <li key={room.id}>
            <RoomNavLink href={`/rooms/${room.id}`}>
              <span className="truncate font-medium">{room.name}</span>
              <span className="text-muted-foreground shrink-0 text-sm">
                {itemCountLabel(room.itemCount)}
              </span>
            </RoomNavLink>
          </li>
        ))}
      </ul>
      <AddRoomButton variant="outline" />
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
