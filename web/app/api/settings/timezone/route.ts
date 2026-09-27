import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return NextResponse.json({ timezone: user?.timezone ?? null });
}

export async function PATCH(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const timezone: string | undefined = body?.timezone;
  if (!timezone || typeof timezone !== "string") {
    return NextResponse.json({ error: "timezone is required" }, { status: 400 });
  }
  try {
    // Intl throws for an unrecognized IANA zone name — cheap validation
    // without a hardcoded zone list.
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { timezone } });
  return NextResponse.json({ timezone });
}
