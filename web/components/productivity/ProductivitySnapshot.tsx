import { ChartDonut } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { snapshotPercentages, type SnapshotSegment, type SnapshotTone } from "@/lib/productivity-snapshot-shared";

// Validated with the dataviz skill's scripts/validate_palette.js — passes
// lightness/chroma/CVD-separation/contrast for both light and dark surfaces
// (dark mode uses its own darker steps from the same ramps, not an
// automatic flip). The one WARN (contrast vs. surface, ~2.5:1) is the
// documented exception: legal because identity is never color-only here —
// every segment also has a visible text label + percentage in the legend.
const TONE_STROKE: Record<SnapshotTone, string> = {
  good: "stroke-emerald-500 dark:stroke-emerald-600",
  warning: "stroke-amber-500 dark:stroke-amber-600",
  neutral: "stroke-sky-500 dark:stroke-sky-600",
  critical: "stroke-red-600",
};
const TONE_BG: Record<SnapshotTone, string> = {
  good: "bg-emerald-500 dark:bg-emerald-600",
  warning: "bg-amber-500 dark:bg-amber-600",
  neutral: "bg-sky-500 dark:bg-sky-600",
  critical: "bg-red-600",
};

const GAP_PERCENT = 1.2;

// One reusable donut for all three data variants (Tasks / Promises /
// Today's Work) — the caller supplies segments+tones, not a new chart per
// dataset. `pathLength={100}` on each circle lets stroke-dasharray be
// expressed directly as percentages instead of hand-computing circumference.
export function ProductivitySnapshot({
  title,
  centerLabel,
  segments,
  insight,
  emptyMessage,
}: {
  title: string;
  centerLabel: string;
  segments: SnapshotSegment[];
  insight?: string | null;
  emptyMessage?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
          <ChartDonut size={22} className="text-text-muted" />
          <p className="text-sm text-text-secondary">{emptyMessage ?? "No data yet."}</p>
        </div>
      </DrawablyCard>
    );
  }

  const percents = snapshotPercentages(
    segments.map((s) => s.value),
    total
  );

  // No running total mutated across iterations (React Compiler's stricter
  // immutability lint flags that) — each offset is just the sum of the
  // percents before it, trivial cost at 3-4 segments.
  const arcs = segments.map((segment, i) => {
    const percent = percents[i];
    const dash = Math.max(percent - GAP_PERCENT, 0);
    const offset = -percents.slice(0, i).reduce((sum, p) => sum + p, 0);
    return { ...segment, percent, dash, offset };
  });

  return (
    <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-28 w-28 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" pathLength={100} className="stroke-surface-subtle" />
            {arcs.map((arc) => (
              <circle
                key={arc.label}
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${arc.dash} ${100 - arc.dash}`}
                strokeDashoffset={arc.offset}
                className={`transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none ${TONE_STROKE[arc.tone]}`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
            <span className="text-center text-[9px] font-medium uppercase leading-tight tracking-wide text-text-secondary">
              {centerLabel}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5">
          {arcs.map((arc) => (
            <div key={arc.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-text-secondary">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[arc.tone]}`} />
                {arc.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">{arc.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {insight && <p className="mt-3 border-t border-border pt-3 text-xs text-text-secondary">{insight}</p>}

      {/* The chart itself is aria-hidden — this is the only way the data is
          announced to assistive tech, not a decoration of it. */}
      <p className="sr-only">
        {title}: {total} total. {arcs.map((arc) => `${arc.value} ${arc.label} (${arc.percent}%).`).join(" ")}
        {insight ? ` ${insight}` : ""}
      </p>
    </DrawablyCard>
  );
}
