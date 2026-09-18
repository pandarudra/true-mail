"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { authClient } from "@/lib/auth-client";

type User = { name: string; email: string };

function initial(user: User): string {
  return (user.name || user.email).charAt(0).toUpperCase();
}

export function TopBar({
  user,
  query,
  onQueryChange,
}: {
  user: User;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div className="flex items-center gap-4 border-b border-black/4 px-5 py-3 dark:border-white/5">
      <BrandMark />
      <div className="relative mx-auto w-full max-w-xl">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search mail"
          className="w-full rounded-full border-0 bg-brand-50/60 py-2 pl-10 pr-3 text-sm outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-brand-400/40 dark:bg-white/5 dark:focus:bg-white/8"
        />
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Account menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-200 dark:bg-brand-500/20 dark:text-brand-300"
        >
          {initial(user)}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-black/4 bg-white p-2 shadow-lg dark:border-white/5 dark:bg-zinc-900">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name || user.email}
                </p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-black/3 dark:text-zinc-400 dark:hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
