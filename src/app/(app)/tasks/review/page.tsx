import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { generateProposals } from "@/app/(app)/tasks/actions";
import { EditNotice } from "@/components/inventory/edit-guard";
import { GenerateButton } from "@/components/tasks/generate-button";
import { ProposalList } from "@/components/tasks/proposal-list";
import { ScopePicker } from "@/components/tasks/scope-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRooms } from "@/lib/inventory/queries";
import { HELPERS } from "@/lib/tasks/helpers";
import { getHomeProfile, getProposals } from "@/lib/tasks/queries";

export const metadata: Metadata = { title: "Propose tasks" };

export default function ReviewPage({ searchParams }: PageProps<"/tasks/review">) {
  return (
    <section aria-labelledby="review-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          id="review-heading"
          className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Propose tasks
        </h1>
        <p className="text-muted-foreground text-sm">
          The AI reads your rooms and items and proposes what to clean, how long it takes, and how
          often. You decide what to keep.
        </p>
      </div>
      <EditNotice />
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewSection searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ReviewSection({ searchParams }: Pick<PageProps<"/tasks/review">, "searchParams">) {
  const [{ room: roomParam }, rooms, proposals, profile] = await Promise.all([
    searchParams,
    getRooms(),
    getProposals(),
    getHomeProfile(),
  ]);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
        <DoorOpen aria-hidden className="text-muted-foreground size-8" />
        <h2 className="font-heading text-lg font-semibold">Your inventory comes first</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Add your rooms and what's in them that needs cleaning. Then the AI can propose tasks.
        </p>
        <Button size="lg" className="h-11" render={<Link href="/rooms" />} nativeButton={false}>
          Go to rooms
        </Button>
      </div>
    );
  }

  const scope = rooms.find((room) => room.id === roomParam) ?? null;
  const helperLabels = HELPERS.filter((h) => profile.helpers.includes(h.id)).map((h) => h.label);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <ScopePicker rooms={rooms} selectedRoomId={scope?.id ?? null} />
        <p className="text-muted-foreground text-sm">
          {helperLabels.length > 0 ? `Helpers: ${helperLabels.join(", ")}. ` : "No helpers yet. "}
          <Link
            href="/home-profile"
            className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
          >
            Tell us about your home
          </Link>
        </p>
        <GenerateButton
          key={scope?.id ?? "home"}
          action={generateProposals.bind(null, scope?.id ?? null)}
          scopeLabel={scope?.name ?? "the whole home"}
        />
      </div>
      <ProposalList proposals={proposals} roomOrder={rooms.map((room) => room.id)} />
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full sm:w-72" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex min-h-16 flex-col justify-center gap-2 px-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
