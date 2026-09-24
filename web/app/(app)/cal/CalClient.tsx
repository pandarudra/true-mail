"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CalendarBlank, CaretLeft, CaretRight, Flag, MapPin, Plus } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { IconButton } from "@/components/ui/IconButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import Cal from "@/components/cal/Cal";
import { MONTHS } from "@/components/cal/types";
import { isSameDay, toISODate } from "@/lib/cal";
import type { Holiday } from "@/lib/holidays/types";
import { useInboxStore, type Mailbox } from "@/lib/stores/inbox-store";
import { useTaskStore, type Priority } from "@/lib/stores/task-store";

const now = new Date();

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "text-text-muted",
  NORMAL: "text-text-secondary",
  HIGH: "text-amber-500",
  URGENT: "text-red-600",
};

export function CalClient({ initialMailboxes }: { initialMailboxes: Mailbox[] }) {
  const { data: session } = authClient.useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(now);

  const [country, setCountry] = useState<string | null>(null);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [pendingCountry, setPendingCountry] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const tasks = useTaskStore((s) => s.tasks);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);

  // Sidebar's Mailboxes/Labels sections read from inbox-store; this page
  // doesn't otherwise mount InboxClient, the only other place that hydrates
  // it (see the same note in TasksClient.tsx).
  useLayoutEffect(() => {
    useInboxStore.getState().init(initialMailboxes);
    useTaskStore.getState().init();
  }, [initialMailboxes]);

  useEffect(() => {
    fetch("/api/holidays/countries")
      .then((res) => res.json())
      .then(({ countries }) => setCountries(countries ?? []));
  }, []);

  // First calendar visit: no location saved yet — the dialog opens itself
  // and, since it has nothing to fall back to, can't be dismissed until the
  // user picks one and saves (see the Dialog's onClose below).
  useEffect(() => {
    fetch("/api/holiday-location")
      .then((res) => res.json())
      .then(({ country }) => {
        setCountry(country ?? null);
        if (!country) setLocationDialogOpen(true);
      });
  }, []);

  useEffect(() => {
    if (!country) return;
    fetch(`/api/holidays?country=${country}&year=${year}`)
      .then((res) => res.json())
      .then(({ holidays }) => setHolidays(holidays ?? []))
      .catch(() => setHolidays([]));
  }, [country, year]);

  const holidaysByDate = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of holidays) (map[h.date] ??= []).push(h);
    return map;
  }, [holidays]);

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  }

  function jumpToMonth(nextMonthIndex: number) {
    setMonthIndex(nextMonthIndex);
  }

  function jumpToYear(nextYear: number) {
    setYear(nextYear);
  }

  async function saveLocation() {
    const selected = pendingCountry || country || countries[0]?.code;
    if (!selected) return;
    setSavingLocation(true);
    const res = await fetch("/api/holiday-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: selected }),
    });
    setSavingLocation(false);
    if (!res.ok) return;
    setCountry(selected);
    setPendingCountry("");
    setLocationDialogOpen(false);
  }

  // "Update" for the year already on screen — the cache otherwise only
  // refreshes itself after its 30-day TTL expires (see lib/holidays/service.ts).
  async function refreshHolidays() {
    if (!country) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/holidays?country=${country}&year=${year}&refresh=1`);
      const { holidays } = await res.json();
      setHolidays(holidays ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  const dayTasks = tasks.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), selectedDate));
  const dayHolidays = holidaysByDate[toISODate(selectedDate)] ?? [];
  const countryName = countries.find((c) => c.code === country)?.name ?? country ?? "";
  const selectedDueAt = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  ).toISOString();

  return (
    <div className="flex h-screen flex-col bg-surface-subtle">
      <TopBar
        user={{
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
          image: session?.user.image,
        }}
        onMenuClick={() => setSidebarOpen(true)}
        calMonthIndex={monthIndex}
        calYear={year}
        onCalMonthChange={jumpToMonth}
        onCalYearChange={jumpToYear}
      />
      <div className="flex flex-1 overflow-hidden bg-surface">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                {MONTHS[monthIndex]} {year}
              </h1>
              <div className="flex items-center gap-2">
                {country && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCountry(country);
                      setLocationDialogOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
                  >
                    <MapPin size={14} />
                    {countryName}
                  </button>
                )}
                <IconButton label="Refresh holidays for this year" onClick={refreshHolidays} disabled={!country}>
                  <ArrowsClockwise size={16} className={refreshing ? "animate-spin" : ""} />
                </IconButton>
                <div className="flex gap-1">
                  <IconButton label="Previous month" onClick={() => shiftMonth(-1)}>
                    <CaretLeft size={16} />
                  </IconButton>
                  <IconButton label="Next month" onClick={() => shiftMonth(1)}>
                    <CaretRight size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
            <Cal
              year={year}
              month={MONTHS[monthIndex]}
              selected={selectedDate}
              onSelectDate={setSelectedDate}
              holidaysByDate={holidaysByDate}
            />

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {isSameDay(selectedDate, now)
                    ? "Today"
                    : selectedDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                </h2>
                <button
                  type="button"
                  onClick={() => setCreatingTask(true)}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-subtle"
                >
                  <Plus size={12} weight="bold" />
                  Add task
                </button>
              </div>

              {dayHolidays.length === 0 && dayTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
                  <CalendarBlank size={22} className="text-text-muted" />
                  <p className="text-sm text-text-secondary">Nothing due this day.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {dayHolidays.length > 0 && (
                    <div>
                      <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                        Holidays
                      </p>
                      <ul className="flex flex-col gap-1">
                        {dayHolidays.map((holiday) => (
                          <li key={holiday.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{holiday.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {dayTasks.length > 0 && (
                    <div>
                      <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                        Tasks
                      </p>
                      <ul className="flex flex-col gap-1">
                        {dayTasks.map((task) => (
                          <li
                            key={task.id}
                            className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-subtle"
                          >
                            <Checkbox
                              checked={task.completed}
                              onChange={(e) => toggleComplete(task.id, e.target.checked)}
                            />
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${
                                task.completed ? "text-text-muted line-through" : "text-foreground"
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.priority !== "NORMAL" && (
                              <Flag
                                size={14}
                                weight="fill"
                                className={`shrink-0 ${PRIORITY_COLOR[task.priority]}`}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={locationDialogOpen}
        onClose={() => country && setLocationDialogOpen(false)}
        title={country ? "Change location" : "Set your location"}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {country
              ? "Pick a different country to see its holidays on the calendar."
              : "Pick your country to see its national and regional holidays on the calendar."}
          </p>
          <Select
            aria-label="Country"
            value={pendingCountry || country || countries[0]?.code || ""}
            onChange={(e) => setPendingCountry(e.target.value)}
          >
            {countries.length === 0 ? (
              <option value="">Loading countries…</option>
            ) : (
              countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))
            )}
          </Select>
          <Button
            type="button"
            onClick={saveLocation}
            disabled={savingLocation || countries.length === 0}
            className="w-fit"
          >
            {savingLocation ? "Saving…" : "Save location"}
          </Button>
        </div>
      </Dialog>

      <NewTaskDialog
        open={creatingTask}
        onClose={() => setCreatingTask(false)}
        defaultDueAt={selectedDueAt}
      />
    </div>
  );
}

export default CalClient;
