import { type InputHTMLAttributes } from "react";
import { DrawablyCheckbox } from "drawably/react";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "width">) {
  return <DrawablyCheckbox roughness={0.3} boil={0.1} className={cn("shrink-0", className)} {...props} />;
}
