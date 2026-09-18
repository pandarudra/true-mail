"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { DrawablyCheckbox } from "drawably/react";
import { cn } from "@/lib/cn";

// Drawably only redraws its hand-drawn checkmark on a native "change" event
// (a direct click). When `checked` flips programmatically — e.g. a "select
// all" toggling every row's prop without the user clicking each one — the
// underlying <input> updates but the drawn checkmark doesn't. Mirror the
// library's own sync (toggling [data-checked] on .drawably-checkbox, which
// its CSS keys the checkmark's visibility off) whenever `checked` changes.
export function Checkbox({
  className,
  checked,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "width">) {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = wrapperRef.current?.querySelector<HTMLElement>(".drawably-checkbox");
    if (!el) return;
    if (checked) el.dataset.checked = "";
    else delete el.dataset.checked;
  }, [checked]);

  return (
    <span ref={wrapperRef} className="contents">
      <DrawablyCheckbox
        roughness={0.3}
        boil={0.1}
        checked={checked}
        className={cn("shrink-0", className)}
        {...props}
      />
    </span>
  );
}
