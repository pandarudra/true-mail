export async function readError(res: Response): Promise<string> {
  const body: { error?: string } | null = await res.json().catch(() => null);
  return body?.error ?? `Request failed (${res.status})`;
}
