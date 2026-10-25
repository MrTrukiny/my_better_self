import type { Metadata } from "next";
import { Suspense } from "react";
import { EditNotice } from "@/components/inventory/edit-guard";
import { RoomList, RoomListSkeleton } from "@/components/inventory/room-list";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage() {
  return (
    <section aria-labelledby="rooms-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          id="rooms-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Rooms
        </h1>
        <p className="text-muted-foreground text-sm">
          Your home, room by room, with what needs cleaning in each.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<RoomListSkeleton />}>
        <RoomList />
      </Suspense>
    </section>
  );
}
