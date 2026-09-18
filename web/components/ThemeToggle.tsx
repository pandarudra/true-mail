"use client";

import { useEffect, useRef } from "react";
import { drawablyToggle } from "drawably";

export function ThemeToggle() {
  const hostRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hostRef.current || !inputRef.current) return;
    // Renders unchecked on both server and first client render (no hydration mismatch), then this
    // corrects the actual DOM checked state post-mount — a safe imperative mutation, not a React-diffed
    // attribute — before drawably's own attach reads it to draw the knob in the right position.
    inputRef.current.checked = document.documentElement.classList.contains("dark");
    const sketch = drawablyToggle(hostRef.current, { roughness: 0.3, boil: 0.1 });
    return () => sketch.destroy();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage unavailable (private browsing) — toggle still works for this session
    }
  }

  return (
    <span ref={hostRef}>
      <input ref={inputRef} type="checkbox" role="switch" aria-label="Toggle theme" onChange={handleChange} />
    </span>
  );
}
