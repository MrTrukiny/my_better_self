import { Check, Clock, type LucideIcon, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FreshnessState } from "@/lib/inventory/freshness";

const STATES: Record<
  FreshnessState,
  { label: string; Icon: LucideIcon; variant: "secondary" | "outline" | "destructive" }
> = {
  fresh: { label: "Fresh", Icon: Sparkles, variant: "secondary" },
  good: { label: "Good", Icon: Check, variant: "secondary" },
  due: { label: "Due", Icon: Clock, variant: "outline" },
  overdue: { label: "Overdue", Icon: TriangleAlert, variant: "destructive" },
};

const NO_TASKS = "No tasks yet";

export function freshnessLabel(state: FreshnessState | null): string {
  return state === null ? NO_TASKS : STATES[state].label;
}

/** A room's freshness (spec 014), or "No tasks yet" for a room without cleaning tasks. */
export function FreshnessBadge({ state }: { state: FreshnessState | null }) {
  if (state === null) {
    return <span className="text-muted-foreground text-sm">{NO_TASKS}</span>;
  }
  const { label, Icon, variant } = STATES[state];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
