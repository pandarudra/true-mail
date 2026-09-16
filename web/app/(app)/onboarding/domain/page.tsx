"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DnsRecordCard } from "@/components/DnsRecordCard";

type Domain = {
  id: string;
  name: string;
  status: string;
  dnsRecords: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
  }>;
};

export default function ConnectDomainPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState<Domain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    const { domain: created } = await res.json();
    setDomain(created);
  }

  async function handleVerify() {
    if (!domain) return;
    setLoading(true);
    const res = await fetch(`/api/domains/${domain.id}/verify`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Verification failed");
      return;
    }
    const { domain: updated } = await res.json();
    setDomain(updated);
    if (updated.status === "verified") {
      router.push("/onboarding/mailbox");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Connect your domain
        </h1>
        {!domain && (
          <>
            <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
              Use a subdomain (e.g. <code>mail.yourdomain.com</code>) to avoid
              conflicts with any email you already have on the root domain.
            </p>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="mail.yourdomain.com"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Continue"}
              </button>
            </form>
          </>
        )}
        {domain && (
          <>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Add these records at your DNS provider, then verify.
            </p>
            <div className="mb-6 flex flex-col gap-3">
              {domain.dnsRecords.map((record, i) => (
                <DnsRecordCard key={i} record={record} />
              ))}
            </div>
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading
                ? "Checking..."
                : domain.status === "verified"
                  ? "Verified — continue"
                  : "Verify domain"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
