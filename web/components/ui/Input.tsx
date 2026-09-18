import { type InputHTMLAttributes } from "react";
import { DrawablyInput } from "drawably/react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "width">) {
  return (
    <DrawablyInput
      roughness={0.3}
      boil={0.1}
      className={cn("w-full text-sm text-foreground", className)}
      {...props}
    />
  );
}
