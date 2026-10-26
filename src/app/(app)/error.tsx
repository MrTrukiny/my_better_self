"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-2xl flex-col items-start gap-3 rounded-xl border p-6"
    >
      <TriangleAlert aria-hidden className="text-muted-foreground size-6" />
      <h2 className="font-heading text-lg font-semibold">Couldn't load this page</h2>
      <p className="text-muted-foreground text-sm">Check your connection and try again.</p>
      <Button type="button" size="lg" className="h-11" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
