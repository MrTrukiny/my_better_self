import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-config";

export default function HomePage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{APP_NAME}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            The app shell is ready. Features will be added through the spec-driven workflow.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
