import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { fulfillPromiseForUser } from "@/lib/promises";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await fulfillPromiseForUser(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ promise: result.promise });
}
