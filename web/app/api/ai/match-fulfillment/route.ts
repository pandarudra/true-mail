import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { parseAddress } from "@/lib/ai/extract-promise";
import { matchFulfillment } from "@/lib/ai/match-fulfillment";

export async function POST(req: Request) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const emailId: string | undefined = body?.emailId;
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 });
  }

  const email = await prisma.email.findFirst({ where: { id: emailId, mailbox: { userId } } });
  if (!email || email.direction !== "in") {
    return NextResponse.json({ match: null });
  }

  const senderEmail = parseAddress(email.from).email?.toLowerCase();
  if (!senderEmail) {
    return NextResponse.json({ match: null });
  }

  // The most recent still-active incoming promise from this sender — not
  // the email it was originally tracked from, so a promise's own source
  // email never "fulfills itself".
  const candidate = await prisma.promise.findFirst({
    where: {
      userId,
      direction: "INCOMING",
      status: "ACTIVE",
      personEmail: { equals: senderEmail, mode: "insensitive" },
      sourceEmailId: { not: emailId },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!candidate) {
    return NextResponse.json({ match: null });
  }

  try {
    const result = await matchFulfillment(candidate.commitment, email);
    if (!result.matches || result.confidence < 0.5) {
      return NextResponse.json({ match: null });
    }
    return NextResponse.json({
      match: { promiseId: candidate.id, commitment: candidate.commitment, confidence: result.confidence },
    });
  } catch {
    return NextResponse.json({ match: null });
  }
}
