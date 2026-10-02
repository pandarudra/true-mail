export function validateInternalRequest(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) return null;
  const incoming = headers["x-internal-secret"];
  if (typeof incoming !== "string" || incoming !== secret) return null;
  const userId = headers["x-user-id"];
  return typeof userId === "string" && userId.trim() ? userId.trim() : null;
}
