"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeClosed } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/GoogleIcon";
import { AuthShell } from "@/components/AuthShell";
import { DrawablyDivider } from "drawably/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";

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
    <AuthShell>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
        Create account
      </p>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
      <p className="mb-8 text-sm text-text-secondary">Your domain. Your email. Your inbox.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="pr-10"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2">
              <IconButton
                label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
              </IconButton>
            </span>
          </div>
          <p className="text-xs text-text-muted">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3">
        <DrawablyDivider roughness={0.3} boil={0.1} className="flex-1" />
        <span className="text-xs text-text-muted">or</span>
        <DrawablyDivider roughness={0.3} boil={0.1} className="flex-1" />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => authClient.signIn.social({ provider: "google" })}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      <p className="mt-6 text-sm text-text-secondary">
        Already have an account?{" "}
        <a href="/login" className="font-medium text-brand-800 dark:text-brand-300">
          Log in
        </a>
      </p>
    </AuthShell>
  );
}
