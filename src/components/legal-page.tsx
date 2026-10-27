import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_UPDATED_ON = "October 27, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-4 text-sm leading-relaxed [&_h2]:mt-2 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">Last updated {LEGAL_UPDATED_ON}</p>
      </header>
      {children}
      <Link href="/sign-in" className="mt-2 underline underline-offset-4">
        Back to sign-in
      </Link>
    </article>
  );
}
