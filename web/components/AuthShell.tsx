"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

export function AuthShell({
  wide = false,
  showSignOut = false,
  children,
}: {
  wide?: boolean;
  showSignOut?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <main className="relative flex min-h-screen">
      {showSignOut && (
        <button
          type="button"
          onClick={handleSignOut}
          className="absolute right-4 top-4 z-10 flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground sm:right-6 sm:top-6"
        >
          <SignOut size={16} />
          Log out
        </button>
      )}
      <aside className="bg-ink relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="bg-grain-texture pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        <BrandMark light className="relative" />
        <p className="relative max-w-xs font-mono text-sm leading-relaxed text-white/45">
          Email infrastructure,
          <br />
          without the clutter.
        </p>
      </aside>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}>
          <BrandMark className="mb-10 lg:hidden" />
          {children}
        </div>
      </div>
    </main>
  );
}
