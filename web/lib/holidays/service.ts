import { prisma } from "@/lib/db";
import { CalendarificProvider } from "./calendarific";
import type { Holiday, HolidayProvider } from "./types";

const provider: HolidayProvider = new CalendarificProvider();

// Calendarific documents a 500-request/month free-tier cap and recommends
// caching — a country/year's holiday list rarely changes, so 30 days is safe.
const TTL_DAYS = 30;

export async function getHolidays(
  country: string,
  year: number,
  region?: string,
  opts?: { forceRefresh?: boolean },
): Promise<Holiday[]> {
  const cacheRegion = region ?? "";
  const key = { country, region: cacheRegion, year, language: "en" };

  if (!opts?.forceRefresh) {
    const cached = await prisma.holidayCache.findUnique({
      where: { country_region_year_language: key },
    });
    if (cached && cached.expiresAt > new Date()) {
      return cached.data as unknown as Holiday[];
    }
  }

  const holidays = await provider.getHolidays(country, year, region);
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.holidayCache.upsert({
    where: { country_region_year_language: key },
    create: { ...key, data: holidays, expiresAt },
    update: { data: holidays, fetchedAt: new Date(), expiresAt },
  });

  return holidays;
}
