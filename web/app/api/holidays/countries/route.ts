import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { getCountries } from "@/lib/holidays/calendarific";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const countries = await getCountries();
    return NextResponse.json({ countries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to fetch countries" },
      { status: 502 },
    );
  }
}
