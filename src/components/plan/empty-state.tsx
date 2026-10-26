import { CalendarClock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon,
  title,
  text,
  href,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
      {icon}
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm">{text}</p>
      <OfflineAwareLink href={href} className={buttonVariants({ size: "lg", className: "h-11" })}>
        {action}
      </OfflineAwareLink>
    </div>
  );
}

export function NoScheduleState() {
  return (
    <EmptyState
      icon={<CalendarClock aria-hidden className="text-muted-foreground size-6" />}
      title="Set your schedule"
      text="Choose the days you clean, when you start, and how many minutes you have. The plan fits your tasks into that time."
      href="/schedule"
      action="Set your schedule"
    />
  );
}

export function NoTasksState() {
  return (
    <EmptyState
      icon={<Sparkles aria-hidden className="text-muted-foreground size-6" />}
      title="Tasks come first"
      text="Once you have cleaning tasks, the plan spreads them over your week."
      href="/tasks/review"
      action="Propose tasks"
    />
  );
}
