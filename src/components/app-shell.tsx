import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { AppNav, NavLinks } from "@/components/app-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <OfflineBanner />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <Link
            href="/"
            className="font-heading min-w-0 truncate text-sm font-semibold sm:text-base"
          >
            {APP_NAME}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Suspense fallback={<NavLinks variant="top" current={null} />}>
              <AppNav variant="top" />
            </Suspense>
            <ThemeToggle />
            <Suspense fallback={<div aria-hidden className="bg-muted size-8 rounded-full" />}>
              <CurrentAccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:py-10">{children}</main>
      <Suspense fallback={<NavLinks variant="tabs" current={null} />}>
        <AppNav variant="tabs" />
      </Suspense>
    </div>
  );
}

async function CurrentAccountMenu() {
  const { name, email, image } = await getCurrentUser();
  return <AccountMenu user={{ name, email, image }} />;
}
