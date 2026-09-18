"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeClosed } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/components/BrandMark";
import { GoogleIcon } from "@/components/GoogleIcon";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signupError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    setLoading(false);
    if (signupError) {
      setError(signupError.message ?? "Sign up failed");
      return;
    }
    router.push("/onboarding/resend");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50/50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-black/4 bg-white p-8 shadow-sm dark:border-white/5 dark:bg-zinc-900">
        <BrandMark className="mb-10 justify-center" />
        <h1 className="mb-1 text-xl font-semibold text-foreground">
          Create your account
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Your domain. Your email. Your inbox.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-white/10"
            />
          </div>
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
              className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 dark:border-white/10"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-black/10 px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-brand-400 dark:border-white/10"
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
            <p className="text-xs text-zinc-400">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-800/20 transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
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
          className="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/3 dark:border-white/10 dark:hover:bg-white/5"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand-800">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
