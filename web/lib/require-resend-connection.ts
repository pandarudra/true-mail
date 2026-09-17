import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function requireResendConnection(userId: string) {
  const connection = await prisma.resendConnection.findUnique({ where: { userId } });
  if (!connection) {
    redirect("/onboarding/resend");
  }
  return connection;
}
