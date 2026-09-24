import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { holidayCountry: true, holidayRegion: true },
  });
  return NextResponse.json({ country: user?.holidayCountry ?? null, region: user?.holidayRegion ?? null });
}

export async function PATCH(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const country: string | undefined = body?.country?.trim();
  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 });
  }
  const region: string | null = body?.region?.trim() || null;

  await prisma.user.update({
    where: { id: userId },
    data: { holidayCountry: country, holidayRegion: region },
  });
  return NextResponse.json({ country, region });
}
