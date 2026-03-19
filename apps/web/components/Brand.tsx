// components/Brand.tsx
"use client"

import Link from "next/link";
import Image from "next/image";
import { useElementTheme } from "components/ElementThemeProvider";

const logoMap = {
  default: "/default/favicon-64x64.png",
  fire: "/fire/favicon-64x64.png",
  water: "/water/favicon-64x64.png",
  earth: "/earth/favicon-64x64.png",
  air: "/air/favicon-64x64.png",
} as const;

export default function Brand({ className = "", textClassName = "text-foreground" }: { className?: string; textClassName?: string; }) {
  const { elementTheme } = useElementTheme();
  const logo = logoMap[elementTheme] ?? logoMap.default;

  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="Resume Bender home">
      <Image
        src={logo}
        alt="Resume Bender"
        width={56}
        height={56}
        priority
      />
      <span className={`font-semibold tracking-tight ${textClassName}`}>Resume Bender</span>
    </Link>
  );
}
