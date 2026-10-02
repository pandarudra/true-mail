import { auth } from "@/lib/auth";

export async function getUserId(headers: Headers): Promise<string | null> {
  // Internal service calls (MCP server → TrueMail) — skip session lookup when
  // both the shared key and a userId are present. Never trust these headers
  // from the public internet; the key is only known to services on the same host.
  const internalKey = headers.get("x-internal-key");
  const internalUserId = headers.get("x-user-id");
  if (
    internalKey &&
    process.env.INTERNAL_API_KEY &&
    internalKey === process.env.INTERNAL_API_KEY &&
    internalUserId?.trim()
  ) {
    return internalUserId.trim();
  }

  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
