"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { useElementTheme, type ElementTheme } from "components/ElementThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { elementTheme, setElementTheme } = useElementTheme();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const currentMode = mounted
    ? (theme === "system" ? resolvedTheme : theme) ?? "light"
    : "light";

  const isDark = currentMode === "dark";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm hover:bg-muted"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span className="text-[10px]">{isDark ? "🌙" : "☀️"}</span>
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>

      <select
        value={elementTheme}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setElementTheme(e.target.value as ElementTheme)
        }
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm hover:bg-muted"
        aria-label="Select elemental theme"
      >
        <option value="default">Default</option>
        <option value="fire">Fire</option>
        <option value="water">Water</option>
        <option value="earth">Earth</option>
        <option value="air">Air</option>
      </select>
    </div>
  );
}