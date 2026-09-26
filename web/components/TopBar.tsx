"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FunnelSimple, Gear, List, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { DrawablyCard, DrawablyCircle, DrawablyDivider } from "drawably/react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AskInbox } from "@/components/ai/AskInbox";
import { AdvancedSearchModal } from "@/components/AdvancedSearchModal";
import { TaskSearchBar } from "@/components/tasks/TaskSearchBar";
import { AdvancedTaskSearchModal } from "@/components/tasks/AdvancedTaskSearchModal";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { MONTHS } from "@/components/cal/types";
import { authClient } from "@/lib/auth-client";
import { useThemeStore } from "@/lib/stores/theme-store";

type User = { name: string; email: string; image?: string | null };

function initial(user: User): string {
  return (user.name || user.email).charAt(0).toUpperCase();
}

const CURRENT_YEAR = new Date().getFullYear();
const CAL_YEARS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i);

export function TopBar({
  user,
  onMenuClick,
  calMonthIndex,
  calYear,
  onCalMonthChange,
  onCalYearChange,
}: {
  user: User;
  onMenuClick?: () => void;
  calMonthIndex?: number;
  calYear?: number;
  onCalMonthChange?: (monthIndex: number) => void;
  onCalYearChange?: (year: number) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const onTasks = pathname === "/tasks";
  const onCal = pathname === "/cal";
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);

  useEffect(() => {
    if (!menuOpen || telegramConnected !== null) return;
    fetch("/api/telegram/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTelegramConnected(data?.connected ?? false))
      .catch(() => setTelegramConnected(false));
  }, [menuOpen, telegramConnected]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-subtle lg:hidden"
        >
          <List size={20} />
        </button>
        <BrandMark className="hidden sm:flex" />
        {onTasks ? <TaskSearchBar /> : onCal ? <div className="min-w-0 flex-1" /> : <AskInbox />}
        {onCal && calMonthIndex !== undefined && calYear !== undefined && (
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <Select
              aria-label="Month"
              value={calMonthIndex}
              onChange={(e) => onCalMonthChange?.(Number(e.target.value))}
              className="w-auto"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Year"
              value={calYear}
              onChange={(e) => onCalYearChange?.(Number(e.target.value))}
              className="w-auto"
            >
              {CAL_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        )}
        {!onCal && (
          <IconButton
            label="Search options"
            onClick={() => setSearchModalOpen(true)}
          >
            <FunnelSimple size={16} />
          </IconButton>
        )}
        {!onCal &&
          (onTasks ? (
            <AdvancedTaskSearchModal
              open={searchModalOpen}
              onClose={() => setSearchModalOpen(false)}
            />
          ) : (
            <AdvancedSearchModal
              open={searchModalOpen}
              onClose={() => setSearchModalOpen(false)}
            />
          ))}
        {/* Moved into the account menu's "General" section on mobile to
            de-clutter the top bar; still here as a quick-access icon on
            desktop, where there's room. */}
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
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
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default bg-black/40 lg:bg-transparent"
            />
          )}
          {/* Same fixed-drawer/lg:static-dropdown split as Sidebar.tsx's mobile
              nav — one component, breakpoint swaps the presentation instead
              of a second mobile-only implementation. */}
          <div
            inert={!menuOpen}
            className={`fixed inset-y-0 right-0 z-40 w-[82%] max-w-xs transition-transform duration-200 ease-out lg:absolute lg:inset-y-auto lg:right-0 lg:top-full lg:z-20 lg:mt-2 lg:w-56 lg:transition-none ${
              menuOpen ? "translate-x-0 lg:block" : "translate-x-full lg:hidden"
            }`}
          >
            <DrawablyCard
              roughness={0.3}
              boil={0.1}
              className="flex h-full flex-col overflow-y-auto bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:h-auto"
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
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
              >
                <Gear size={16} />
                Settings
              </button>

              <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
                General
              </p>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                <span className="flex-1">Appearance</span>
                <span className="text-xs text-text-secondary">{isDark ? "Dark" : "Light"}</span>
              </button>

              <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Connectors
              </p>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/settings#telegram");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/tg-icon.png" alt="" className="h-4 w-4 shrink-0 rounded-[3px]" />
                <span className="flex-1">Telegram</span>
                {telegramConnected && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Connected" />
                )}
              </button>

              <div className="mt-auto">
                <DrawablyDivider roughness={0.3} boil={0.1} className="my-1" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
                >
                  <SignOut size={16} />
                  Sign out
                </button>
              </div>
            </DrawablyCard>
          </div>
        </div>
      </div>
      <DrawablyDivider roughness={0.3} boil={0.1} />
    </div>
  );
}
