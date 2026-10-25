import { ClipboardList } from "lucide-react";
import { deleteItem } from "@/app/(app)/rooms/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { itemLabel } from "@/lib/inventory/format";
import { getItemType } from "@/lib/inventory/item-types";
import type { RoomDetail } from "@/lib/inventory/queries";
import { DeleteConfirm } from "./delete-confirm";
import { AddItemButton, EditItemButton } from "./item-form";

export function ItemList({ room }: { room: RoomDetail }) {
  const isEmpty = room.items.length === 0;

  // AddItemButton keeps the same position in both branches so its open dialog survives the
  // re-render that swaps the empty state for the list after the first item is added.
  return (
    <div
      className={
        isEmpty
          ? "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center"
          : "flex flex-col gap-4"
      }
    >
      {isEmpty ? (
        <>
          <ClipboardList aria-hidden className="text-muted-foreground size-8" />
          <h2 className="font-heading text-lg font-semibold">No items yet</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            List what's in this room that needs cleaning, like windows, shelves, or the sink.
          </p>
        </>
      ) : (
        <ul
          aria-label={`Items in ${room.name}`}
          className="flex flex-col divide-y overflow-hidden rounded-xl border"
        >
          {room.items.map((item) => {
            const Icon = getItemType(item.type)?.icon;
            const label = itemLabel(item);
            return (
              <li key={item.id} className="flex min-h-14 items-center gap-3 py-1 pr-1 pl-4">
                {Icon ? (
                  <Icon aria-hidden className="text-muted-foreground size-5 shrink-0" />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{label}</span>
                  {item.note ? (
                    <span className="text-muted-foreground truncate text-sm">{item.note}</span>
                  ) : null}
                </div>
                <EditItemButton item={item} />
                <DeleteConfirm
                  iconOnly
                  triggerLabel={`Delete ${item.name}`}
                  title={`Delete ${label}?`}
                  description={`It will be removed from ${room.name}. This can't be undone.`}
                  action={deleteItem.bind(null, item.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <AddItemButton roomId={room.id} />
    </div>
  );
}

export function RoomDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex min-h-14 items-center gap-3 px-4">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
