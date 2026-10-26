import { ChevronRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EditNotice } from "@/components/inventory/edit-guard";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { TaskList, TaskListSkeleton } from "@/components/tasks/task-list";
import { TasksCacheWarmer } from "@/components/tasks/tasks-cache-warmer";
import { Button } from "@/components/ui/button";
import { getRooms } from "@/lib/inventory/queries";
import { getProposals, getTasks } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <section aria-labelledby="tasks-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            id="tasks-heading"
            className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Tasks
          </h1>
          <p className="text-muted-foreground text-sm">
            What gets cleaned, how long it takes, and how often.{" "}
            <OfflineAwareLink
              href="/home-profile"
              className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
            >
              Home profile
            </OfflineAwareLink>
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-11 shrink-0"
          render={<OfflineAwareLink href="/tasks/review" />}
          nativeButton={false}
        >
          <Sparkles aria-hidden />
          Propose tasks
        </Button>
      </div>
      <EditNotice />
      <Suspense fallback={<TaskListSkeleton />}>
        <TasksSection />
      </Suspense>
      <Suspense>
        <TasksCacheWarmer />
      </Suspense>
    </section>
  );
}

async function TasksSection() {
  const [tasks, proposals, rooms] = await Promise.all([getTasks(), getProposals(), getRooms()]);
  const pending = proposals.length;
  return (
    <div className="flex flex-col gap-6">
      {pending > 0 ? (
        <OfflineAwareLink
          href="/tasks/review"
          className="bg-muted hover:bg-muted/70 focus-visible:ring-ring flex min-h-11 items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2"
        >
          {pending} {pending === 1 ? "proposal" : "proposals"} waiting for review
          <ChevronRight aria-hidden className="size-4 shrink-0" />
        </OfflineAwareLink>
      ) : null}
      <TaskList tasks={tasks} roomOrder={rooms.map((room) => room.id)} />
    </div>
  );
}
