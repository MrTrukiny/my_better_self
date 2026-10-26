"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOME = "home";

/** Picks what to propose for; the choice lives in the URL (`?room=`) so it survives reloads. */
export function ScopePicker({
  rooms,
  selectedRoomId,
}: {
  rooms: { id: string; name: string }[];
  selectedRoomId: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const editsDisabled = useEditsDisabled();
  const items = { [HOME]: "Whole home", ...Object.fromEntries(rooms.map((r) => [r.id, r.name])) };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Propose for</Label>
      <Select
        value={selectedRoomId ?? HOME}
        items={items}
        disabled={editsDisabled}
        onValueChange={(value) => {
          const query = value && value !== HOME ? `?room=${value}` : "";
          router.replace(`/tasks/review${query}`, { scroll: false });
        }}
      >
        <SelectTrigger id={id} className="h-11 w-full text-base sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value={HOME} className="min-h-10 text-base">
            Whole home
          </SelectItem>
          {rooms.map((room) => (
            <SelectItem key={room.id} value={room.id} className="min-h-10 text-base">
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
