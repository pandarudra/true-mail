import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { loadOwnedPromise, updatePromiseForUser } from "@/lib/promises";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const promise = await loadOwnedPromise(id, userId);
  if (!promise) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ promise });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const result = await updatePromiseForUser(id, userId, {
    commitment: typeof body?.commitment === "string" ? body.commitment : undefined,
    personName: "personName" in body ? body.personName : undefined,
    personEmail: "personEmail" in body ? body.personEmail : undefined,
    dueAt: "dueAt" in body ? body.dueAt : undefined,
    status: typeof body?.status === "string" ? body.status : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ promise: result.promise });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await loadOwnedPromise(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.promise.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
