import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";
import { signInErrorMessage } from "@/lib/auth-errors";
import { safeCallbackPath } from "@/lib/callback-url";
import { getOptionalUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground text-sm">{APP_DESCRIPTION}</p>
      </div>
      <Suspense fallback={<SignInFormPlaceholder />}>
        <SignInPanel searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function SignInPanel({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(firstValue(params.callbackURL));
  if (await getOptionalUser()) {
    redirect(callbackURL);
  }
  return (
    <SignInForm
      callbackURL={callbackURL}
      errorMessage={signInErrorMessage(firstValue(params.error))}
    />
  );
}

function SignInFormPlaceholder() {
  return (
    <Button size="lg" className="h-11 w-full text-base" disabled>
      Continue with Google
    </Button>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
