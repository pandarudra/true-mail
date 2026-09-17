"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Globe } from "@phosphor-icons/react";
import { DnsRecordCard } from "@/components/DnsRecordCard";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { readError } from "@/lib/api-error";

export type Domain = {
  id: string;
  name: string;
  status: string;
  dnsRecords: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    status?: string;
  }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  pending:
    "Not verified yet. Add the records above at your DNS provider — propagation can take a few minutes to a few hours, then try again.",
  not_started:
    "Not verified yet. Add the records above at your DNS provider — propagation can take a few minutes to a few hours, then try again.",
  failed:
    "Verification failed. Double-check the records above match exactly what your DNS provider has, then try again.",
  partially_verified:
    "Some records are still pending — check the badges above, then try again once they're all verified.",
  partially_failed:
    "One or more records failed verification — check the badges above against your DNS provider, then try again.",
};

type ImportableDomain = {
  id: string;
  name: string;
  status: string;
};

export function DomainClient({
  importable,
  initialDomain = null,
}: {
  importable: ImportableDomain[];
  initialDomain?: Domain | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState<Domain | null>(initialDomain);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(importable.length === 0);
  const [verifyAttempted, setVerifyAttempted] = useState(false);

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
      setError(await readError(res));
      return;
    }
    const { domain: created } = await res.json();
    setDomain(created);
  }

  async function handleImport(resendDomainId: string) {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resendDomainId }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const { domain: created } = await res.json();
    setDomain(created);
  }

  async function handleVerify() {
    if (!domain) return;
    setLoading(true);
    setVerifyAttempted(true);
    const res = await fetch(`/api/domains/${domain.id}/verify`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      setError(await readError(res));
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
        <BrandMark className="mb-10" />
        <OnboardingSteps current={2} />
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Globe size={22} weight="bold" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Connect your domain
        </h1>
        {!domain && !addingNew && importable.length > 0 && (
          <>
            <p className="mb-6 text-sm text-zinc-500">
              These domains are already on your Resend account. Pick one to
              use it here, or add a new one.
            </p>
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            <div className="mb-6 flex flex-col gap-2">
              {importable.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleImport(d.id)}
                  className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-left text-sm transition-colors hover:border-indigo-400 disabled:opacity-50 dark:border-white/10"
                >
                  <span className="font-medium text-foreground">{d.name}</span>
                  <span className="text-xs text-zinc-500">{d.status}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Add a new domain instead
            </button>
          </>
        )}
        {!domain && addingNew && (
          <>
            <p className="mb-8 text-sm text-zinc-500">
              Use a subdomain (e.g. <code>mail.yourdomain.com</code>) to avoid
              conflicts with any email you already have on the root domain.
            </p>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="domain" className="text-sm font-medium text-foreground">
                  Domain
                </label>
                <input
                  id="domain"
                  type="text"
                  placeholder="mail.yourdomain.com"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="self-start rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Continue"}
                </button>
                {importable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddingNew(false)}
                    className="text-sm font-medium text-zinc-500 hover:underline"
                  >
                    Back to existing domains
                  </button>
                )}
              </div>
            </form>
          </>
        )}
        {domain && (
          <>
            <p className="mb-6 text-sm text-zinc-500">
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
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              {domain.status === "verified" && <CheckCircle size={16} weight="fill" />}
              {loading
                ? "Checking..."
                : domain.status === "verified"
                  ? "Verified. Continue"
                  : "Verify domain"}
            </button>
            {!loading && verifyAttempted && domain.status !== "verified" && (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
                {STATUS_MESSAGES[domain.status] ?? STATUS_MESSAGES.pending}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
