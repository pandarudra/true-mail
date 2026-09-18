import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getConnectionForUser } from "@/lib/resend-client";
import { getReceivingAttachment } from "@/lib/resend";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const userId = await getUserId(req.headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const email = await prisma.email.findFirst({ where: { id, mailbox: { userId } } });
  if (!email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, emailId: id },
  });
  if (!attachment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (attachment.cloudinaryUrl) {
    return NextResponse.redirect(attachment.cloudinaryUrl);
  }

  if (attachment.resendAttachmentId && email.resendEmailId) {
    const connectionResult = await getConnectionForUser(userId);
    if (!connectionResult) {
      return NextResponse.json({ error: "no Resend connection" }, { status: 400 });
    }
    const result = await getReceivingAttachment(connectionResult.resend, {
      emailId: email.resendEmailId,
      id: attachment.resendAttachmentId,
    });
    if (!result?.data) {
      return NextResponse.json({ error: "attachment unavailable" }, { status: 502 });
    }
    return NextResponse.redirect(result.data.download_url);
  }

  return NextResponse.json({ error: "attachment unavailable" }, { status: 502 });
}
