"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { FormError } from "@/components/inventory/form-messages";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/inventory/action-state";

/**
 * "Sync now" and the last-synced line. `children` are the other calendar buttons, kept in the
 * same row.
 */
export function SyncNowButton({
  action,
  lastSynced,
  children,
}: {
  action: () => Promise<ActionState>;
  lastSynced: string;
  children?: ReactNode;
}) {
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const editsDisabled = useEditsDisabled();

  function sync() {
    setError(undefined);
    setSynced(false);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.formError);
        return;
      }
      setSynced(true);
    });
  }

  return (
    <>
      <p role="status" className="text-muted-foreground text-sm">
        {synced ? "Synced just now" : lastSynced}
      </p>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-11"
          onClick={sync}
          disabled={isPending || editsDisabled}
        >
          {isPending ? (
            <>
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <RefreshCw aria-hidden />
              Sync now
            </>
          )}
        </Button>
        {children}
      </div>
    </>
  );
}
