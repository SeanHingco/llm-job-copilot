// tailwind.config.ts
export default {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: { 
    extend: {
      colors: {
        // App shell
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Surfaces
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",

        // Muted / subtle
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",

        // Borders / inputs / rings
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Brand / accent
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",

        // Destructive
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
      },
    }, 
  },
  plugins: [],
}