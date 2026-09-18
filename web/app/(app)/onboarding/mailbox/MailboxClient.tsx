"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { At } from "@phosphor-icons/react";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { readError } from "@/lib/api-error";

type Domain = { id: string; name: string };

export function MailboxClient({ domains }: { domains: Domain[] }) {
  const router = useRouter();
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [localPart, setLocalPart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError(await readError(res));
      return;
    }
    router.push("/inbox");
  }

  const selectedDomain = domains.find((d) => d.id === domainId);

  return (
    <AuthShell wide>
      <OnboardingSteps current={3} />
      <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
        <At size={22} weight="bold" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
        Create your first mailbox
      </h1>
      <p className="mb-8 text-sm text-text-secondary">
        Choose the address that will receive and send mail on your domain.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="localPart" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="localPart"
              type="text"
              placeholder="hello"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              required
              className="min-w-0 flex-1"
            />
            <span className="text-text-muted">@</span>
            <Select aria-label="Domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {localPart && selectedDomain && (
          <p className="text-sm text-text-secondary">
            This creates{" "}
            <span className="font-mono text-foreground">
              {localPart}@{selectedDomain.name}
            </span>
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !domainId}>
          {loading ? "Creating..." : "Create mailbox"}
        </Button>
      </form>
    </AuthShell>
  );
}
