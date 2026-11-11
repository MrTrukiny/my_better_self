import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { suggestTaskAdjustments } from "@/app/(app)/tasks/adjustments/actions";
import { EditNotice } from "@/components/inventory/edit-guard";
import { AdjustmentList } from "@/components/tasks/adjustment-list";
import { SuggestAdjustmentsButton } from "@/components/tasks/suggest-adjustments-button";
import { TasksCacheWarmer } from "@/components/tasks/tasks-cache-warmer";
import { Skeleton } from "@/components/ui/skeleton";
import { getRooms } from "@/lib/inventory/queries";
import { getCurrentUser } from "@/lib/session";
import { readReviewTasks } from "@/lib/tasks/adjustment-queries";
import { reviewLine } from "@/lib/tasks/adjustments";
import { getAdjustments } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Adjustments" };

export default function AdjustmentsPage() {
  return (
    <section
      aria-labelledby="adjustments-page-heading"
      className="mx-auto flex max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h1
          id="adjustments-page-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Adjustments
        </h1>
        <p className="text-muted-foreground text-sm">
          The AI compares your tasks with the times you recorded and the notes you wrote, and
          suggests changes. You decide what to keep.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<AdjustmentsSkeleton />}>
        <AdjustmentsSection />
      </Suspense>
      <Suspense>
        <TasksCacheWarmer />
      </Suspense>
    </section>
  );
}

async function AdjustmentsSection() {
  // Which tasks qualify follows check-offs, which the tasks cache doesn't track.
  await io();
  const user = await getCurrentUser();
  const [reviewTasks, adjustments, rooms] = await Promise.all([
    readReviewTasks(user.id),
    getAdjustments(),
    getRooms(),
  ]);
  const count = reviewTasks.length;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        {count > 0 ? <p className="text-sm">{reviewLine(count)}</p> : null}
        <SuggestAdjustmentsButton
          action={suggestTaskAdjustments}
          unavailableReason={count > 0 ? undefined : reviewLine(0)}
        />
      </div>
      <AdjustmentList adjustments={adjustments} roomOrder={rooms.map((room) => room.id)} />
    </div>
  );
}

function AdjustmentsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-11 w-48" />
      </div>
    </div>
  );
}
