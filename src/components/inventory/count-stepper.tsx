"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNT_MAX, COUNT_MIN } from "@/lib/inventory/schemas";

type CountStepperProps = {
  id: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function CountStepper({ defaultValue = "1", disabled, ...inputProps }: CountStepperProps) {
  const [value, setValue] = useState(defaultValue);
  const numeric = Number(value);
  const isNumber = value.trim() !== "" && Number.isFinite(numeric);

  function step(delta: number) {
    const base = isNumber ? Math.round(numeric) : COUNT_MIN;
    setValue(String(Math.min(COUNT_MAX, Math.max(COUNT_MIN, base + delta))));
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Decrease count"
        onClick={() => step(-1)}
        disabled={disabled || (isNumber && numeric <= COUNT_MIN)}
      >
        <Minus aria-hidden />
      </Button>
      <Input
        {...inputProps}
        type="number"
        inputMode="numeric"
        min={COUNT_MIN}
        max={COUNT_MAX}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className="h-11 w-20 text-center text-base"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Increase count"
        onClick={() => step(1)}
        disabled={disabled || (isNumber && numeric >= COUNT_MAX)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
