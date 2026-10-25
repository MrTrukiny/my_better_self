"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { useEditsDisabled } from "./edit-guard";
import { FormError } from "./form-messages";

type DeleteConfirmProps = {
  title: string;
  description: string;
  action: () => Promise<ActionState>;
  /** Accessible name for the trigger, e.g. "Delete Window". Defaults to "Delete". */
  triggerLabel?: string;
  /** Show only the icon in the trigger; `triggerLabel` still names it. */
  iconOnly?: boolean;
  redirectTo?: string;
};

export function DeleteConfirm({
  title,
  description,
  action,
  triggerLabel = "Delete",
  iconOnly = false,
  redirectTo,
}: DeleteConfirmProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const editsDisabled = useEditsDisabled();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.formError);
        return;
      }
      setOpen(false);
      if (redirectTo) {
        router.replace(redirectTo);
      }
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
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon" : "lg"}
        className={iconOnly ? "text-muted-foreground size-11" : "h-11"}
        aria-label={iconOnly ? triggerLabel : undefined}
        onClick={() => setOpen(true)}
        disabled={editsDisabled}
      >
        <Trash2 aria-hidden />
        {iconOnly ? null : triggerLabel}
      </Button>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
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
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
