"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";

// The dark class is set by an inline script in layout.tsx before paint (and
// by toggle() below) — useSyncExternalStore reads it back without a
// server/client hydration mismatch, since the server snapshot is allowed to
// differ and React reconciles after hydration on its own.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable (private browsing) — toggle still works for this session
    }
  }

  return (
    <IconButton label={isDark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
