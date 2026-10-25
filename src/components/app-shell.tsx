import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { InventoryLink } from "@/components/inventory/inventory-link";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/app-config";
import { getCurrentUser } from "@/lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <OfflineBanner />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="font-heading text-base font-semibold">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <nav aria-label="Main">
              <InventoryLink
                href="/rooms"
                className="hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2"
              >
                Rooms
              </InventoryLink>
            </nav>
            <ThemeToggle />
            <Suspense fallback={<div aria-hidden className="bg-muted size-8 rounded-full" />}>
              <CurrentAccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}

async function CurrentAccountMenu() {
  const { name, email, image } = await getCurrentUser();
  return <AccountMenu user={{ name, email, image }} />;
}
