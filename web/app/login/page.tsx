"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: loginError } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message ?? "Login failed");
      return;
    }
    router.push("/inbox");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">
          Log in to TrueMail
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google" })}
          className="mt-4 w-full rounded-md border border-black/10 px-4 py-2 font-medium transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
        >
          Continue with Google
        </button>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No account?{" "}
          <a href="/signup" className="font-medium text-indigo-600">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
