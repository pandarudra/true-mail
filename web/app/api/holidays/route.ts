import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { getHolidays } from "@/lib/holidays/service";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const year = Number(url.searchParams.get("year"));
  const region = url.searchParams.get("region") || undefined;
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!country || !Number.isInteger(year)) {
    return NextResponse.json({ error: "country and year are required" }, { status: 400 });
  }

  try {
    const holidays = await getHolidays(country, year, region, { forceRefresh });
    return NextResponse.json({ holidays });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to fetch holidays" },
      { status: 502 },
    );
  }
}
