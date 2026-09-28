"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, EnvelopeSimple, Handshake, ListChecks, PencilSimpleLine } from "@phosphor-icons/react";
import { StatTile } from "@/components/ui/StatTile";
import { ProductivitySnapshot } from "@/components/productivity/ProductivitySnapshot";
import { ActivityGraph } from "@/components/overview/ActivityGraph";
import type { ActivityDay, Snapshot } from "@/lib/productivity-snapshot-shared";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type SnapshotVariant = "tasks" | "promises" | "today";

const VARIANT_LABEL: Record<SnapshotVariant, string> = {
  tasks: "Tasks",
  promises: "Promises",
  today: "Today",
};

// Three variants already existed server-side (app/api/productivity-snapshot)
// but nothing surfaced promises/today anywhere in the UI — this tab switcher
// is the first thing to actually show them, no new backend work.
const VARIANT_META: Record<SnapshotVariant, { title: string; centerLabel: string; emptyMessage: string }> = {
  tasks: {
    title: "Task Snapshot",
    centerLabel: "Total Tasks",
    emptyMessage: "Create your first task to start tracking your productivity.",
  },
  promises: {
    title: "Promise Snapshot",
    centerLabel: "Active Promises",
    emptyMessage: "Track a promise to see it here.",
  },
  today: {
    title: "Today's Work",
    centerLabel: "Due Today",
    emptyMessage: "Nothing due today.",
  },
};

export function OverviewDashboard({
  name,
  unreadCount,
  taskCount,
  snapshots,
  activity,
}: {
  name?: string | null;
  unreadCount: number;
  taskCount: number;
  snapshots: Record<SnapshotVariant, Snapshot>;
  activity: ActivityDay[];
}) {
  const router = useRouter();
  const [variant, setVariant] = useState<SnapshotVariant>("tasks");
  const meta = VARIANT_META[variant];

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm text-text-secondary">{greeting()}</p>
        <h1 className="text-2xl font-semibold text-foreground">{name?.split(" ")[0] ?? "there"}&apos;s overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-2xl lg:grid-cols-5">
        <StatTile
          icon={<EnvelopeSimple size={16} weight="bold" />}
          label="Unread"
          value={unreadCount}
          tone="brand"
          onClick={() => router.push("/inbox")}
        />
        <StatTile
          icon={<PencilSimpleLine size={16} weight="bold" />}
          label="Compose"
          tone="amber"
          onClick={() => router.push("/compose")}
        />
        <StatTile
          icon={<ListChecks size={16} weight="bold" />}
          label="Tasks"
          value={taskCount}
          tone="emerald"
          onClick={() => router.push("/tasks")}
        />
        <StatTile
          icon={<CalendarBlank size={16} weight="bold" />}
          label="Calendar"
          tone="brand"
          onClick={() => router.push("/cal")}
        />
        <StatTile
          icon={<Handshake size={16} weight="bold" />}
          label="Promises"
          value={snapshots.promises.total}
          tone="amber"
          onClick={() => router.push("/promises")}
        />
      </div>

      <div className="max-w-xl">
        <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Snapshot type">
          {(Object.keys(VARIANT_LABEL) as SnapshotVariant[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={variant === key}
              onClick={() => setVariant(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                variant === key
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-border text-text-secondary"
              }`}
            >
              {VARIANT_LABEL[key]}
            </button>
          ))}
        </div>
        <ProductivitySnapshot
          title={meta.title}
          centerLabel={meta.centerLabel}
          segments={snapshots[variant].segments}
          insight={snapshots[variant].insight}
          emptyMessage={meta.emptyMessage}
        />
      </div>

      <div className="max-w-4xl">
        <ActivityGraph data={activity} title="Task & Promise Activity" />
      </div>
    </div>
  );
}
