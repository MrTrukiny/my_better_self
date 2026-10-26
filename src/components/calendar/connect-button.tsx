"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { CALENDAR_SCOPES } from "@/lib/calendar/scopes";

const CONNECTED_PATH = "/api/calendar/connected";
const START_FAILED = "Couldn't reach Google. Try again.";

/**
 * Asks Google for the calendar permissions on top of sign-in (Better Auth `linkSocial`), with
 * offline access so the daily job can sync. With the fake calendar it skips Google.
 */
export function ConnectButton({
  label,
  email,
  fake,
  variant = "default",
}: {
  label: string;
  email: string;
  fake: boolean;
  variant?: "default" | "outline";
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const editsDisabled = useEditsDisabled();

  async function connect() {
    setIsPending(true);
    setError(undefined);
    if (fake) {
      window.location.assign(CONNECTED_PATH);
      return;
    }
    const result = await authClient.linkSocial({
      provider: "google",
      scopes: [...CALENDAR_SCOPES],
      callbackURL: CONNECTED_PATH,
      errorCallbackURL: "/schedule?calendar=denied",
      loginHint: email,
      additionalParams: { access_type: "offline", prompt: "consent" },
    });
    // On success the browser is already leaving for Google; only failures return here.
    if (result?.error) {
      setError(START_FAILED);
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size="lg"
        className="h-11"
        onClick={connect}
        disabled={isPending || editsDisabled}
      >
        {isPending ? (
          <>
            <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            Opening Google...
          </>
        ) : (
          label
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
