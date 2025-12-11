"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Use resolvedTheme so "system" still displays correctly
  const current = (theme === "system" ? resolvedTheme : theme) ?? "light";
  const isDark = current === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm hover:bg-muted"
      aria-label={isDark ? "Dark mode" : "Light mode"}
    >
      <span className="text-[10px]">{isDark ? "🌙" : "☀️"}</span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
