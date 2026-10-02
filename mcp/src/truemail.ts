const base = () => process.env.TRUEMAIL_API_URL ?? "http://localhost:3000";
const key = () => process.env.INTERNAL_API_KEY ?? "";

function internalHeaders(userId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-key": key(),
    "x-user-id": userId,
  };
}

export async function tmGet(userId: string, path: string): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    headers: internalHeaders(userId),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TrueMail ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function tmPatch(
  userId: string,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    method: "PATCH",
    headers: internalHeaders(userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TrueMail PATCH ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function tmPost(
  userId: string,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: internalHeaders(userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TrueMail POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
