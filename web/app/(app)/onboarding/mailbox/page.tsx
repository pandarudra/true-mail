"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Domain = { id: string; name: string; status: string };

export default function CreateMailboxPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/domains")
      .then((res) => res.json())
      .then(({ domains: all }: { domains: Domain[] }) => {
        const verified = all.filter((d) => d.status === "verified");
        setDomains(verified);
        if (verified[0]) setDomainId(verified[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId, localPart }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    router.push("/inbox");
  }

  const selectedDomain = domains.find((d) => d.id === domainId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">
          Create your first mailbox
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="hello"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              required
              className="flex-1 rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
            />
            <span className="text-zinc-500">@</span>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {localPart && selectedDomain && (
            <p className="text-sm text-zinc-500">
              This creates{" "}
              <span className="font-mono">
                {localPart}@{selectedDomain.name}
              </span>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !domainId}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create mailbox"}
          </button>
        </form>
      </div>
    </main>
  );
}
