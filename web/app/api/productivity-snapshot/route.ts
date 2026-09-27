import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { getTaskSnapshot, getPromiseSnapshot, getTodaySnapshot } from "@/lib/productivity-snapshot";

const VARIANTS = {
  tasks: getTaskSnapshot,
  promises: getPromiseSnapshot,
  today: getTodaySnapshot,
} as const;

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const variant = new URL(req.url).searchParams.get("variant") ?? "tasks";
  const getSnapshot = VARIANTS[variant as keyof typeof VARIANTS];
  if (!getSnapshot) {
    return NextResponse.json({ error: "invalid variant" }, { status: 400 });
  }

  const snapshot = await getSnapshot(userId);
  return NextResponse.json({ snapshot });
}
