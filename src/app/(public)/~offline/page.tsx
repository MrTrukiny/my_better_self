import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold">You are offline</h1>
      <p className="text-muted-foreground max-w-sm">
        This page is not available without a connection. Reconnect and try again.
      </p>
    </section>
  );
}
