import type { Holiday, HolidayCategory, HolidayProvider } from "./types";

type CalendarificHoliday = {
  name: string;
  description: string;
  country: { id: string; name: string };
  date: { iso: string };
  type: string[];
  urlid: string;
};

// Calendarific's `type` field is free-text ("National holiday", "Hinduism",
// "Optional holiday", ...), not the clean bucket list its own docs describe —
// bucket it with keyword matching rather than an exhaustive lookup table.
const RELIGIOUS_KEYWORDS = ["religious", "hindu", "islam", "muslim", "christ", "buddh", "sikh", "jewish", "jain"];

export function normalizeCategory(types: string[]): HolidayCategory {
  const joined = types.join(" ").toLowerCase();
  if (joined.includes("national")) return "NATIONAL";
  if (joined.includes("local")) return "LOCAL";
  if (joined.includes("bank")) return "BANK";
  if (RELIGIOUS_KEYWORDS.some((k) => joined.includes(k))) return "RELIGIOUS";
  return "OBSERVANCE";
}

function apiKey(): string {
  const key = process.env.CALENDARFIC_API_KEY;
  if (!key) throw new Error("CALENDARFIC_API_KEY is not set");
  return key;
}

export class CalendarificProvider implements HolidayProvider {
  async getHolidays(country: string, year: number, region?: string): Promise<Holiday[]> {
    const params = new URLSearchParams({ api_key: apiKey(), country, year: String(year) });
    if (region) params.set("location", region);

    const res = await fetch(`https://calendarific.com/api/v2/holidays?${params}`);
    const json = await res.json();
    if (json.meta?.code !== 200) {
      throw new Error(json.meta?.error_detail ?? `Calendarific request failed: ${res.status}`);
    }

    const holidays: CalendarificHoliday[] = json.response.holidays;
    return holidays.map((h) => ({
      id: h.urlid,
      date: h.date.iso,
      name: h.name,
      description: h.description,
      country: h.country.id.toUpperCase(),
      region: region ?? null,
      category: normalizeCategory(h.type),
      source: "calendarific" as const,
    }));
  }
}

// ponytail: module-level in-memory cache, resets on server restart — fine for
// a country list that changes essentially never. Upgrade to the HolidayCache
// table (see lib/holidays/service.ts) if that stops being true.
let countriesCache: { code: string; name: string }[] | null = null;
let countriesCachedAt = 0;
const COUNTRIES_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCountries(): Promise<{ code: string; name: string }[]> {
  if (countriesCache && Date.now() - countriesCachedAt < COUNTRIES_TTL_MS) {
    return countriesCache;
  }

  const res = await fetch(`https://calendarific.com/api/v2/countries?api_key=${apiKey()}`);
  const json = await res.json();
  if (json.meta?.code !== 200) {
    throw new Error(json.meta?.error_detail ?? `Calendarific request failed: ${res.status}`);
  }

  const countries: { country_name: string; "iso-3166": string }[] = json.response.countries;
  countriesCache = countries
    .map((c) => ({ code: c["iso-3166"], name: c.country_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  countriesCachedAt = Date.now();
  return countriesCache;
}
