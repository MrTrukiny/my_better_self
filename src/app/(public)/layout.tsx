import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/offline-banner";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <OfflineBanner />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
