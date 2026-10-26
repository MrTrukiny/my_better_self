"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { FormError } from "@/components/inventory/form-messages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/inventory/action-state";

export function DisconnectButton({ action }: { action: () => Promise<ActionState> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const editsDisabled = useEditsDisabled();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.formError);
        return;
      }
      setOpen(false);
    });
  }

  function onOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next);
      setError(undefined);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-11"
        onClick={() => setOpen(true)}
        disabled={editsDisabled}
      >
        Disconnect
      </Button>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              The Cleaning calendar and its events will be deleted from your Google Calendar, and
              the app's access to your calendars is removed. Your plan keeps working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={error} />
          <AlertDialogFooter>
            <AlertDialogCancel size="lg" className="h-11" disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="lg"
              className="h-11"
              onClick={confirm}
              disabled={isPending || editsDisabled}
            >
              {isPending ? (
                <>
                  <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect calendar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
