"use client";

import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import type { RecurrenceInput, RecurrenceType } from "@/lib/stores/task-store";

const REPEAT_LABEL: Record<RecurrenceType, string> = {
  DAILY: "Daily",
  WEEKDAYS: "Weekdays",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const DAY_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

export type RecurrenceValue = {
  recurrenceType: RecurrenceType;
  recurrenceDaysOfWeek: number[];
  reminderEnabled: boolean;
  reminderTime: string; // "HH:mm"
};

export function toRecurrenceInput(value: RecurrenceValue | null): RecurrenceInput | null {
  if (!value) return null;
  return {
    recurrenceType: value.recurrenceType,
    recurrenceDaysOfWeek: value.recurrenceDaysOfWeek,
    reminderEnabled: value.reminderEnabled,
    reminderTime: value.reminderTime,
  };
}

// Shared by NewTaskDialog and TaskDetailDialog — same "Repeat" form either
// way, just seeded from defaults vs. an existing task's stored recurrence.
export function RecurrenceEditor({
  value,
  onChange,
}: {
  value: RecurrenceValue | null;
  onChange: (value: RecurrenceValue | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">Repeat</span>
        <Select
          aria-label="Repeat"
          value={value?.recurrenceType ?? "NONE"}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "NONE") {
              onChange(null);
              return;
            }
            const recurrenceType = next as RecurrenceType;
            onChange({
              recurrenceType,
              recurrenceDaysOfWeek: recurrenceType === "WEEKLY" ? (value?.recurrenceDaysOfWeek.length ? value.recurrenceDaysOfWeek : [new Date().getDay()]) : [],
              reminderEnabled: value?.reminderEnabled ?? true,
              reminderTime: value?.reminderTime ?? "09:00",
            });
          }}
          className="w-auto"
        >
          <option value="NONE">Doesn&apos;t repeat</option>
          {(Object.keys(REPEAT_LABEL) as RecurrenceType[]).map((t) => (
            <option key={t} value={t}>
              {REPEAT_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {value && (
        <>
          {value.recurrenceType === "WEEKLY" && (
            <div className="flex gap-1">
              {DAY_LABEL.map((label, day) => {
                const active = value.recurrenceDaysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        ...value,
                        recurrenceDaysOfWeek: active
                          ? value.recurrenceDaysOfWeek.filter((d) => d !== day)
                          : [...value.recurrenceDaysOfWeek, day].sort(),
                      })
                    }
                    className={`h-7 w-7 shrink-0 rounded-full border text-xs ${
                      active ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10" : "border-border text-text-secondary"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <Checkbox checked={value.reminderEnabled} onChange={(e) => onChange({ ...value, reminderEnabled: e.target.checked })} />
              Remind me
            </label>
            <Input
              type="time"
              aria-label="Reminder time"
              value={value.reminderTime}
              onChange={(e) => onChange({ ...value, reminderTime: e.target.value })}
              className="w-auto px-2 py-1 text-xs"
            />
          </div>
        </>
      )}
    </div>
  );
}
