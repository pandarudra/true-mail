import { type ReactNode } from "react";
import { DrawablyCard } from "drawably/react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "amber" | "emerald";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
};

// A small tinted tile — icon in a colored circle, label, and an optional
// real count. `value` is left out entirely (not shown as "—" or similar)
// when a screen has nothing genuine to put there, rather than faking one.
export function StatTile({
  icon,
  label,
  value,
  tone = "brand",
  onClick,
  className,
}: {
  icon: ReactNode;
  label: string;
  value?: string | number;
  tone?: Tone;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <DrawablyCard
      roughness={0.3}
      boil={0.1}
      className={cn("bg-surface p-3", className)}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex w-full flex-col items-start gap-2 text-left disabled:cursor-default"
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[tone])}>
          {icon}
        </span>
        <span className="flex w-full items-baseline justify-between gap-1">
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          {value !== undefined && (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-text-secondary">{value}</span>
          )}
        </span>
      </button>
    </DrawablyCard>
  );
}
