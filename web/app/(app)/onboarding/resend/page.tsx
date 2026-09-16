"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Connect your Resend account
        </h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
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
          <input
            type="password"
            placeholder="re_xxxxxxxxxxxxxxxxxxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 font-mono text-sm dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </main>
  );
}
