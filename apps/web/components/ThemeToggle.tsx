"use client";

import { useTheme } from "next-themes";
import * as React from "react";

type ElementTheme = "default" | "fire" | "water" | "earth" | "air";
const KEY = "rb_element_theme";

export function useElementTheme() {
  const [elementTheme, setElementThemeState] = React.useState<ElementTheme>("default");

  // load on mount
  React.useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ElementTheme | null) ?? "default";
    setElementThemeState(saved);
    const root = document.documentElement;
    if (saved === "default") delete root.dataset.theme;
    else root.dataset.theme = saved;
  }, []);

  // setter that updates DOM + localStorage
  const setElementTheme = React.useCallback((t: ElementTheme) => {
    setElementThemeState(t);
    localStorage.setItem(KEY, t);
    const root = document.documentElement;
    if (t === "default") delete root.dataset.theme;
    else root.dataset.theme = t;
  }, []);

  return { elementTheme, setElementTheme };
}



export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { elementTheme, setElementTheme } = useElementTheme();

  const currentMode = (theme === "system" ? resolvedTheme : theme) ?? "light";
  const isDark = currentMode === "dark";

  return (
    <div className="inline-flex items-center gap-2">
      {/* Light / Dark */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm hover:bg-muted"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span className="text-[10px]">{isDark ? "🌙" : "☀️"}</span>
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>

      {/* Element palette */}
      <select
        value={elementTheme}
        onChange={(e) => setElementTheme(e.target.value as any)}
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
