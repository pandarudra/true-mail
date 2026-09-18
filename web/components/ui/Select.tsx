import { type SelectHTMLAttributes } from "react";
import { DrawablySelect } from "drawably/react";
import { cn } from "@/lib/cn";

export function Select({
  className,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "width">) {
  return (
    <DrawablySelect roughness={0.3} boil={0.1} className={cn("text-sm text-foreground", className)} {...props}>
      {children}
    </DrawablySelect>
  );
}
