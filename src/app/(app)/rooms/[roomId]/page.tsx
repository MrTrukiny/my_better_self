import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteRoom } from "@/app/(app)/rooms/actions";
import { DeleteConfirm } from "@/components/inventory/delete-confirm";
import { EditNotice } from "@/components/inventory/edit-guard";
import { InventoryLink } from "@/components/inventory/inventory-link";
import { ItemList, RoomDetailSkeleton } from "@/components/inventory/item-list";
import { OfflineCacheWarmer } from "@/components/inventory/offline-cache-warmer";
import { RenameRoomButton } from "@/components/inventory/room-form";
import { itemCountLabel } from "@/lib/inventory/format";
import { getRoom } from "@/lib/inventory/queries";

export const metadata: Metadata = { title: "Room" };

export default function RoomPage({ params }: PageProps<"/rooms/[roomId]">) {
  return (
    <div className="flex flex-col gap-4">
      <InventoryLink
        href="/rooms"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex h-11 w-fit items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-2 lg:hidden"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All rooms
      </InventoryLink>
      <Suspense fallback={<RoomDetailSkeleton />}>
        <RoomDetailSection params={params} />
      </Suspense>
    </div>
  );
}

async function RoomDetailSection({ params }: Pick<PageProps<"/rooms/[roomId]">, "params">) {
  const { roomId } = await params;
  const room = await getRoom(roomId);
  const itemCount = room.items.length;
  const itemsClause =
    itemCount === 0 ? "" : ` and its ${itemCount === 1 ? "item" : `${itemCount} items`}`;

  return (
    <section aria-labelledby="room-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            id="room-heading"
            className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl"
          >
            {room.name}
          </h1>
          <p className="text-muted-foreground text-sm">{itemCountLabel(itemCount)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <RenameRoomButton room={{ id: room.id, name: room.name }} />
          <DeleteConfirm
            title={`Delete ${room.name}?`}
            description={`This deletes ${room.name}${itemsClause}. This can't be undone.`}
            action={deleteRoom.bind(null, room.id)}
            redirectTo="/rooms"
          />
        </div>
      </div>
      <EditNotice />
      <ItemList room={room} />
      <OfflineCacheWarmer urls={["/rooms", `/rooms/${room.id}`]} version={JSON.stringify(room)} />
    </section>
  );
}
