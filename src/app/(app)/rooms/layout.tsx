import { Suspense } from "react";
import { RoomList, RoomListSkeleton } from "@/components/inventory/room-list";
import { RoomsSidebar } from "@/components/inventory/room-nav-link";

export default function RoomsLayout({ children }: LayoutProps<"/rooms">) {
  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      <RoomsSidebar>
        <div className="w-72 shrink-0">
          <Suspense fallback={<RoomListSkeleton />}>
            <RoomList />
          </Suspense>
        </div>
      </RoomsSidebar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
