import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function requireMailboxes(userId: string) {
  const mailboxes = await prisma.mailbox.findMany({ where: { userId } });
  if (mailboxes.length === 0) {
    redirect("/onboarding/mailbox");
  }
  return mailboxes;
}
