"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingSteps } from "@/components/OnboardingSteps";

export default function ConnectResendPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/resend-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Something went wrong");
      return;
    }
    router.push("/onboarding/domain");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <BrandMark className="mb-10" />
        <OnboardingSteps current={1} />
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <EnvelopeSimple size={22} weight="bold" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Connect your Resend account
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          TrueMail sends and receives email through your own Resend account.
          Paste an API key from{" "}
          <a
            href="https://resend.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600"
          >
            resend.com/api-keys
          </a>
          .
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="apiKey" className="text-sm font-medium text-foreground">
              Resend API key
            </label>
            <input
              id="apiKey"
              type="password"
              placeholder="re_xxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              className="rounded-lg border border-black/10 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </main>
  );
}
