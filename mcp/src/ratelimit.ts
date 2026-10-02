const store = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = store.get(userId);
  if (!entry || now >= entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_MINUTE) return false;
  entry.count++;
  return true;
}
