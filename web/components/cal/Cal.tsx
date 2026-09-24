import React from "react";
import { DrawablyCard } from "drawably/react";
import { buildCal, isSameDay, toISODate } from "@/lib/cal";
import type { Holiday } from "@/lib/holidays/types";
import type { Month } from "./types";

interface CalProps {
  year: number;
  month: Month;
  selected?: Date | null;
  onSelectDate?: (date: Date) => void;
  holidaysByDate?: Record<string, Holiday[]>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const today = new Date();

const Cal = ({ year, month, selected, onSelectDate, holidaysByDate }: CalProps) => {
  const weeks = buildCal(year, month);

  return (
    <DrawablyCard roughness={0.3} boil={0.1} className="w-full bg-surface p-3 sm:p-4">
      <div className="grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-text-secondary">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-2">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {weeks.map((week, wi) =>
          week.map((date, di) => {
            const isToday = date !== null && isSameDay(date, today);
            const isSelected = date !== null && selected != null && isSameDay(date, selected);
            const dayHolidays = date ? holidaysByDate?.[toISODate(date)] : undefined;
            return (
              <button
                key={`${wi}-${di}`}
                type="button"
                disabled={date === null}
                onClick={() => date && onSelectDate?.(date)}
                title={dayHolidays?.map((h) => h.name).join(", ")}
                className={`relative flex h-10 items-center justify-center rounded-full text-sm transition-colors active:scale-95 ${
                  date === null
                    ? "cursor-default"
                    : isSelected
                      ? "bg-brand-500 font-semibold text-white"
                      : isToday
                        ? "font-semibold text-brand-600 dark:text-brand-300"
                        : "text-foreground hover:bg-surface-subtle"
                }`}
              >
                {date ? date.getDate() : ""}
                {isToday && !isSelected && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-500" />
                )}
                {dayHolidays && dayHolidays.length > 0 && (
                  <span
                    className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-amber-500"
                    }`}
                  />
                )}
              </button>
            );
          }),
        )}
      </div>
    </DrawablyCard>
  );
};

export default Cal;
