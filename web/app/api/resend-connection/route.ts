import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// The connection itself is created by the OAuth flow — see
// app/api/oauth/resend/start and .../callback. This route only reports
// status for the onboarding UI.
export async function GET(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const connection = await prisma.resendConnection.findUnique({
    where: { userId },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ connected: !!connection, connection });
}
