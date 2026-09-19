"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gear, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import { DrawablyCard, DrawablyCircle, DrawablyDivider } from "drawably/react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/Input";
import { authClient } from "@/lib/auth-client";
import { useInboxStore } from "@/lib/stores/inbox-store";

type User = { name: string; email: string; image?: string | null };

function initial(user: User): string {
  return (user.name || user.email).charAt(0).toUpperCase();
}

export function TopBar({ user }: { user: User }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const query = useInboxStore((s) => s.query);
  const setQuery = useInboxStore((s) => s.setQuery);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-5 py-3">
        <BrandMark />
        <div className="relative mx-auto w-full max-w-xl">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            className="pl-10"
          />
        </div>
        <ThemeToggle />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-brand-800 transition-colors hover:bg-surface-subtle dark:text-brand-300"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <DrawablyCircle roughness={0.3} boil={0.1}>
                {initial(user)}
              </DrawablyCircle>
            )}
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56">
                <DrawablyCard
                  roughness={0.3}
                  boil={0.1}
                  className="bg-surface p-2"
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name || user.email}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
                  >
                    <Gear size={16} />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
                  >
                    <SignOut size={16} />
                    Sign out
                  </button>
                </DrawablyCard>
              </div>
            </>
          )}
        </div>
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} />
    </div>
  );
}
