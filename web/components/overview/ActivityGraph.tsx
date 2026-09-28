import { DrawablyCard } from "drawably/react";
import { computeStreaks, type ActivityDay } from "@/lib/productivity-snapshot-shared";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BLOCK = 11;
const GAP = 3;
const RADIUS = 2;
const LABEL_HEIGHT = 16;

// Sequential brand ramp, level 0 (no activity) excluded — validated with the
// dataviz skill's scripts/validate_palette.js --ordinal against both card
// surfaces (light #ffffff, dark #131417): brand-300→500→700→800 passes
// monotone-lightness/gap/light-end-contrast in light mode. Dark mode reuses
// the same four steps in reverse (own steps per the skill, not an automatic
// flip) — on a near-black card, the palest step reads as dim/low and the
// brightest as the standout "most active" square, which a straight reuse of
// the light-mode order would get backwards.
const LEVEL_FILL: Record<number, string> = {
  0: "fill-surface-subtle",
  1: "fill-brand-300 dark:fill-brand-800",
  2: "fill-brand-500 dark:fill-brand-700",
  3: "fill-brand-700 dark:fill-brand-500",
  4: "fill-brand-800 dark:fill-brand-300",
};

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type Week = (ActivityDay | undefined)[];

// Pads the first week with leading blanks so day-of-week rows line up,
// mirroring kibo-ui's contribution-graph groupByWeeks (ported without the
// date-fns dependency this repo doesn't otherwise use).
function groupByWeeks(data: ActivityDay[]): Week[] {
  if (data.length === 0) return [];
  const leadingBlanks = parseISODate(data[0].date).getDay();
  const padded: Week = [...(new Array(leadingBlanks).fill(undefined) as undefined[]), ...data];
  const weeks: Week[] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

type MonthLabel = { weekIndex: number; label: string };

function getMonthLabels(weeks: Week[]): MonthLabel[] {
  const raw: MonthLabel[] = [];
  for (const [weekIndex, week] of weeks.entries()) {
    const first = week.find((d) => d !== undefined);
    if (!first) continue;
    const label = MONTH_LABELS[parseISODate(first.date).getMonth()];
    if (raw.at(-1)?.label !== label) raw.push({ weekIndex, label });
  }
  // Drop a label that would clip against the graph's left/right edge.
  const MIN_WEEKS = 3;
  return raw.filter(({ weekIndex }, i) => {
    if (i === 0) return raw[1] ? raw[1].weekIndex - weekIndex >= MIN_WEEKS : true;
    if (i === raw.length - 1) return weeks.length - weekIndex >= MIN_WEEKS;
    return true;
  });
}

function LegendSwatch({ level }: { level: number }) {
  return (
    <svg width={BLOCK} height={BLOCK} aria-hidden="true">
      <rect width={BLOCK} height={BLOCK} rx={RADIUS} ry={RADIUS} strokeWidth={1} className={`stroke-border ${LEVEL_FILL[level]}`} />
    </svg>
  );
}

// GitHub-style calendar heatmap of completed tasks + fulfilled promises —
// same visual pattern as kibo-ui's contribution-graph, hand-ported into a
// single component (no context/sub-component composition) since this app
// has exactly one consumer, and without date-fns/cn since neither is
// otherwise used in this codebase.
export function ActivityGraph({ data, title = "Activity" }: { data: ActivityDay[]; title?: string }) {
  if (data.length === 0) return null;

  const weeks = groupByWeeks(data);
  const monthLabels = getMonthLabels(weeks);
  const width = weeks.length * (BLOCK + GAP) - GAP;
  const height = LABEL_HEIGHT + (BLOCK + GAP) * 7 - GAP;
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const rangeWeeks = Math.round(data.length / 7);
  const { longest: longestStreak } = computeStreaks(data);

  return (
    <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            {totalCount} completed in the last {rangeWeeks} weeks
          </p>
        </div>
        {longestStreak > 0 && (
          <div className="flex items-center gap-1.5" title={`Longest streak: ${longestStreak} day${longestStreak === 1 ? "" : "s"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- animated
                gif; next/image would drop the animation on optimization */}
            <img src="/gif/streak_fire_crop.gif" alt="" width={29} height={32} className="h-8 w-auto shrink-0" />
            <div className="leading-tight">
              <p className="text-base font-semibold tabular-nums text-foreground">{longestStreak}</p>
              <p className="text-[10px] uppercase tracking-wide text-text-secondary">day streak</p>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-full overflow-x-auto overflow-y-hidden">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
          <title>{title}</title>
          <g className="fill-text-muted text-[10px]">
            {monthLabels.map(({ label, weekIndex }) => (
              <text key={weekIndex} x={(BLOCK + GAP) * weekIndex} y={0} dominantBaseline="hanging">
                {label}
              </text>
            ))}
          </g>
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) return null;
              return (
                <rect
                  key={day.date}
                  x={(BLOCK + GAP) * weekIndex}
                  y={LABEL_HEIGHT + (BLOCK + GAP) * dayIndex}
                  width={BLOCK}
                  height={BLOCK}
                  rx={RADIUS}
                  ry={RADIUS}
                  strokeWidth={1}
                  className={`stroke-border ${LEVEL_FILL[day.level]}`}
                >
                  <title>{`${day.count} completed on ${day.date}`}</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>

      <div className="ml-auto mt-2 flex w-fit items-center gap-[3px] text-xs text-text-secondary">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <LegendSwatch key={level} level={level} />
        ))}
        <span>More</span>
      </div>
    </DrawablyCard>
  );
}
