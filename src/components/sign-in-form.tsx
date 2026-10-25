"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsOffline } from "@/hooks/use-is-offline";
import { authClient } from "@/lib/auth-client";
import { GENERIC_SIGN_IN_ERROR } from "@/lib/auth-errors";
import { SIGN_IN_PATH } from "@/lib/callback-url";

const OFFLINE_REASON = "You're offline. Connect to the internet to sign in.";

export function SignInForm({
  callbackURL,
  errorMessage,
}: {
  callbackURL: string;
  errorMessage?: string;
}) {
  const isOffline = useIsOffline();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(errorMessage);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reasonId = useId();

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    } else {
      buttonRef.current?.focus();
    }
  }, [error]);

  async function signIn() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setError(undefined);
    const errorCallbackURL = `${SIGN_IN_PATH}?${new URLSearchParams({ callbackURL })}`;
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL,
    });
    // On success the browser is already leaving for Google; only failures return here.
    if (result?.error) {
      setError(GENERIC_SIGN_IN_ERROR);
      setIsPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Button
        ref={buttonRef}
        size="lg"
        className="h-11 w-full text-base"
        onClick={signIn}
        disabled={isPending || isOffline}
        aria-describedby={isOffline ? reasonId : undefined}
      >
        {isPending ? (
          <>
            <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            Signing in...
          </>
        ) : (
          "Continue with Google"
        )}
      </Button>
      {isOffline ? (
        <p id={reasonId} className="text-muted-foreground text-center text-sm">
          {OFFLINE_REASON}
        </p>
      ) : null}
      {error ? (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="text-destructive text-center text-sm outline-none"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
