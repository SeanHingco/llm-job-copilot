"use client";

import * as React from "react";

export type ElementTheme = "default" | "fire" | "water" | "earth" | "air";

type ElementThemeContextValue = {
  elementTheme: ElementTheme;
  setElementTheme: (theme: ElementTheme) => void;
};

const KEY = "rb_element_theme";

const ElementThemeContext = React.createContext<ElementThemeContextValue | null>(null);

export function ElementThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [elementTheme, setElementThemeState] =
    React.useState<ElementTheme>("default");

  React.useEffect(() => {
    const saved = (localStorage.getItem(KEY) as ElementTheme | null) ?? "default";
    setElementThemeState(saved);

    const root = document.documentElement;
    if (saved === "default") delete root.dataset.theme;
    else root.dataset.theme = saved;
  }, []);

  const setElementTheme = React.useCallback((theme: ElementTheme) => {
    setElementThemeState(theme);
    localStorage.setItem(KEY, theme);

    const root = document.documentElement;
    if (theme === "default") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, []);

  const value = React.useMemo(
    () => ({ elementTheme, setElementTheme }),
    [elementTheme, setElementTheme]
  );

  return (
    <ElementThemeContext.Provider value={value}>
      {children}
    </ElementThemeContext.Provider>
  );
}

export function useElementTheme() {
  const ctx = React.useContext(ElementThemeContext);
  if (!ctx) {
    throw new Error("useElementTheme must be used within ElementThemeProvider");
  }
  return ctx;
}