"use client";

import { useEffect } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { useThemeStore } from "@/lib/stores/theme-store";

export function ThemeToggle() {
  const isDark = useThemeStore((s) => s.isDark);
  const syncFromDom = useThemeStore((s) => s.syncFromDom);
  const toggle = useThemeStore((s) => s.toggle);

  useEffect(() => {
    syncFromDom();
  }, [syncFromDom]);

  return (
    <IconButton
      label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
