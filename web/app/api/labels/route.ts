import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const labels = await prisma.label.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return NextResponse.json({ labels });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name: string | undefined = body?.name?.trim();
  const color: string | undefined = body?.color;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.label.findUnique({ where: { userId_name: { userId, name } } });
  if (existing) {
    return NextResponse.json({ error: "a label with that name already exists" }, { status: 409 });
  }

  const label = await prisma.label.create({
    data: { userId, name, color: color || undefined },
  });
  return NextResponse.json({ label });
}
