export type HolidayCategory = "NATIONAL" | "LOCAL" | "RELIGIOUS" | "BANK" | "OBSERVANCE" | "CUSTOM";

export type Holiday = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description: string;
  country: string;
  region: string | null;
  category: HolidayCategory;
  source: "calendarific" | "custom";
};

export interface HolidayProvider {
  getHolidays(country: string, year: number, region?: string): Promise<Holiday[]>;
}
