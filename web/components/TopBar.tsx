"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FunnelSimple,
  Gear,
  List,
  Moon,
  SignOut,
  Sun,
} from "@phosphor-icons/react";
import { DrawablyCard, DrawablyCircle, DrawablyDivider } from "drawably/react";
import { BrandMark } from "@/components/BrandMark";
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
  const onInbox = pathname === "/inbox";
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const syncThemeFromDom = useThemeStore((s) => s.syncFromDom);

  useEffect(() => {
    if (!menuOpen) return;
    if (telegramConnected === null) {
      fetch("/api/telegram/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setTelegramConnected(data?.connected ?? false))
        .catch(() => setTelegramConnected(false));
    }
    if (gmailConnected === null) {
      fetch("/api/gmail/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setGmailConnected(data?.connected ?? false))
        .catch(() => setGmailConnected(false));
    }
  }, [menuOpen, telegramConnected, gmailConnected]);

  // Picks up the class the blocking inline script in layout.tsx already
  // applied before paint — see theme-store.ts's syncFromDom doc.
  useEffect(() => {
    syncThemeFromDom();
  }, [syncThemeFromDom]);

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
        {onTasks ? <TaskSearchBar /> : onInbox ? <AskInbox /> : <div className="min-w-0 flex-1" />}
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
        {(onTasks || onInbox) && (
          <IconButton
            label="Search options"
            onClick={() => setSearchModalOpen(true)}
          >
            <FunnelSimple size={16} />
          </IconButton>
        )}
        {onTasks && (
          <AdvancedTaskSearchModal
            open={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
        )}
        {onInbox && (
          <AdvancedSearchModal
            open={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
          />
        )}
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
              // z-30 sits above the mobile drawer's backdrop, but the desktop
              // dropdown below is lg:z-20 — without lg:z-10 here, this
              // full-viewport click-outside layer sat on top of it there and
              // ate every click meant for a menu item.
              className="fixed inset-0 z-30 cursor-default bg-black/40 lg:z-10 lg:bg-transparent"
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
                <span className="flex-1">{isDark ? "Dark" : "Light"}</span>
                <span className="text-xs text-text-secondary">Appearance</span>
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
                <img
                  src="/icons/tg-icon.png"
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-[3px]"
                />
                <span className="flex-1">Telegram</span>
                {telegramConnected && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                    title="Connected"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/settings#gmail");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="flex-1">Gmail</span>
                {gmailConnected && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                    title="Connected"
                  />
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
