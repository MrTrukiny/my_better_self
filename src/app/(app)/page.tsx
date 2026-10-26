import { ChevronRight } from "lucide-react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-config";

export default function HomePage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{APP_NAME}</h1>
      <OfflineAwareLink
        href="/rooms"
        className="focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
      >
        <Card className="hover:bg-muted/40 transition-colors">
          <CardHeader className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Home inventory</CardTitle>
              <CardDescription>
                Add the rooms of your home and what's in them that needs cleaning.
              </CardDescription>
            </div>
            <ChevronRight aria-hidden className="text-muted-foreground size-5 shrink-0" />
          </CardHeader>
        </Card>
      </OfflineAwareLink>
    </section>
  );
}
