import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

export function SubmitButton({
  label,
  isPending,
  disabled,
}: {
  label: string;
  isPending: boolean;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" size="lg" className="h-11" disabled={isPending || disabled}>
      {isPending ? (
        <>
          <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
          Saving...
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/** Moves focus to the first invalid control so keyboard and screen reader users land on it. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
