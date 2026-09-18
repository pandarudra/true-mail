import { type ButtonHTMLAttributes } from "react";
import { DrawablyButton } from "drawably/react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const drawablyVariant = {
  primary: "outline",
  secondary: "outline",
  destructive: "outline",
} as const;

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  if (variant === "ghost") {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50",
          className,
        )}
        {...props}
      />
    );
  }

  const tone = variant === "destructive" ? "danger" : variant === "secondary" ? "neutral" : undefined;

  return (
    <DrawablyButton
      variant={drawablyVariant[variant]}
      tone={tone}
      roughness={0.3}
      boil={0.1}
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}
