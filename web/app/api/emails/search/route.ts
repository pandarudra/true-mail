import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { searchEmailsForUser } from "@/lib/emails";
import { isFolderId } from "@/lib/mail-folders";

export async function GET(req: Request) {
  const userId = await getUserId(req.headers as unknown as Headers);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? undefined;
  const folder = url.searchParams.get("folder") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 20) : 10;

  const emails = await searchEmailsForUser(userId, {
    query,
    folder: folder && isFolderId(folder) ? folder : undefined,
    limit,
  });

  return NextResponse.json({ emails });
}
