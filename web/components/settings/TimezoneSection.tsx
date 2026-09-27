"use client";

import { useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import { DrawablyCard, DrawablyDivider } from "drawably/react";

// Populated from the native Intl zone list — no hardcoded list, no new
// dependency (ponytail: native platform feature over a data file).
const ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export function TimezoneSection() {
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/timezone")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTimezone(data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone))
      .catch(() => {});
  }, []);

  async function save(value: string) {
    setTimezone(value);
    setSaving(true);
    await fetch("/api/settings/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: value }),
    });
    setSaving(false);
  }

  return (
    <>
      <DrawablyDivider roughness={0.3} boil={0.1} className="my-6" />
      <h2 className="mb-3 text-sm font-semibold text-foreground">Timezone</h2>
      <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface-subtle p-4">
        <div className="flex items-center gap-3">
          <Clock size={20} className="shrink-0 text-text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-secondary">
              Used so recurring task reminders fire at the right time for you.
            </p>
          </div>
          <select
            aria-label="Timezone"
            value={timezone ?? ""}
            onChange={(e) => save(e.target.value)}
            disabled={saving || timezone === null}
            className="min-h-11 shrink-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground disabled:opacity-50"
          >
            {timezone && !ZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </DrawablyCard>
    </>
  );
}
