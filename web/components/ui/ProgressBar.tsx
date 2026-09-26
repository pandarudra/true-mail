import { cn } from "@/lib/cn";

// Pure — clamps value to [0, max] before converting to a percent, and
// guards max<=0 (an empty subtask list, etc.) to 0 rather than NaN/Infinity.
// Exported separately so it's unit-tested without a component-rendering
// setup, matching this codebase's existing pure-function-first test style.
export function progressPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((Math.min(Math.max(value, 0), max) / max) * 100);
}

// `value`/`max` rather than a raw 0-100 percent — callers (subtask counts,
// etc.) almost always have a fraction on hand, not a pre-computed percent.
export function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const percent = progressPercent(value, max);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle", className)}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
