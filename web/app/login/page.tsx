"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeClosed } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/components/BrandMark";
import { GoogleIcon } from "@/components/GoogleIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <BrandMark className="mb-10 justify-center" />
        <h1 className="mb-1 text-xl font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="mb-8 text-sm text-zinc-500">Log in to your inbox.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-black/10 px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-indigo-400 dark:border-white/10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className="text-xs text-zinc-400">or</span>
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>
        <button
          type="button"
          onClick={() => authClient.signIn.social({ provider: "google" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="mt-6 text-center text-sm text-zinc-500">
          No account?{" "}
          <a href="/signup" className="font-medium text-indigo-600">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
