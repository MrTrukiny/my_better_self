import { OfflineAwareLink } from "@/components/offline-aware-link";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/plan", label: "Mine", household: false },
  { href: "/plan?view=household", label: "Household", household: true },
] as const;

/** Switches the plan between the signed-in person's tasks and everyone's (spec 015). */
export function PlanViewToggle({ household }: { household: boolean }) {
  return (
    <nav aria-label="Whose plan" className="bg-muted flex w-fit gap-1 rounded-lg p-1">
      {VIEWS.map((view) => {
        const current = view.household === household;
        return (
          <OfflineAwareLink
            key={view.href}
            href={view.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring inline-flex h-11 min-w-24 items-center justify-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2",
              current
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {view.label}
          </OfflineAwareLink>
        );
      })}
    </nav>
  );
}
