"use client";

import { useEffect, useRef, type AnchorHTMLAttributes } from "react";
import { drawablyButton } from "drawably";
import { cn } from "@/lib/cn";

export function DrawablyLinkButton({
  variant = "outline",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "solid" | "outline";
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const sketch = drawablyButton(ref.current, {
      variant,
      roughness: 0.3,
      boil: 0.1,
    });
    return () => sketch.destroy();
  }, [variant]);

  return (
    <a
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 text-sm font-medium",
        className,
      )}
      {...props}
    />
  );
}
