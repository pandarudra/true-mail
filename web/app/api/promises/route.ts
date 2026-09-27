import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { createPromiseForUser, getPromisesForUser } from "@/lib/promises";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Derived status (DUE_SOON/OVERDUE) is attached per-row; filter pills on
  // the client slice this same array, the same way Tasks' smart views do.
  const promises = await getPromisesForUser(userId);
  return NextResponse.json({ promises });
}

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const commitment: string | undefined = body?.commitment;
  const direction: string | undefined = body?.direction;
  if (!commitment?.trim() || !direction) {
    return NextResponse.json({ error: "commitment and direction are required" }, { status: 400 });
  }

  const result = await createPromiseForUser(userId, {
    direction,
    commitment,
    personName: typeof body?.personName === "string" ? body.personName : null,
    personEmail: typeof body?.personEmail === "string" ? body.personEmail : null,
    dueAt: body?.dueAt ?? null,
    confidence: typeof body?.confidence === "number" ? body.confidence : null,
    sourceEmailId: typeof body?.sourceEmailId === "string" ? body.sourceEmailId : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ promise: result.promise });
}
