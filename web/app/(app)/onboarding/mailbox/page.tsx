"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { At } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingSteps } from "@/components/OnboardingSteps";

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
        <BrandMark className="mb-10" />
        <OnboardingSteps current={3} />
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <At size={22} weight="bold" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Create your first mailbox
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Choose the address that will receive and send mail on your domain.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="localPart" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <div className="flex items-center gap-2">
              <input
                id="localPart"
                type="text"
                placeholder="hello"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                required
                className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
              />
              <span className="text-zinc-400">@</span>
              <select
                aria-label="Domain"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
              >
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {localPart && selectedDomain && (
            <p className="text-sm text-zinc-500">
              This creates{" "}
              <span className="font-mono text-foreground">
                {localPart}@{selectedDomain.name}
              </span>
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !domainId}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create mailbox"}
          </button>
        </form>
      </div>
    </main>
  );
}
