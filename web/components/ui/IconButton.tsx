import { type ButtonHTMLAttributes } from "react";
import { DrawablyButton } from "drawably/react";
import { cn } from "@/lib/cn";

type Tone = "default" | "active" | "danger";

const drawablyTone: Record<Tone, "neutral" | "danger" | undefined> = {
  default: "neutral",
  active: undefined,
  danger: "danger",
};

export function IconButton({
  className,
  tone = "default",
  stroke,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; stroke?: string; label: string }) {
  return (
    <DrawablyButton
      variant="outline"
      tone={stroke ? undefined : drawablyTone[tone]}
      stroke={stroke}
      roughness={0.3}
      boil={0.1}
      aria-label={label}
      title={label}
      className={cn("drawably-icon-btn flex h-8 w-8 items-center justify-center", className)}
      {...props}
    />
  );
}
