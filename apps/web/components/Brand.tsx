// components/Brand.tsx
import Link from "next/link";
import Image from "next/image";

export default function Brand({ className = "", textClassName = "text-foreground" }: { className?: string; textClassName?: string; }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="Resume Bender home">
      <Image
        src="/favicon-64x64.png"            // or "/logo.png"
        alt="Resume Bender"
        width={48}
        height={48}
        priority
      />
      <span className={`font-semibold tracking-tight ${textClassName}`}>Resume Bender</span>
    </Link>
  );
}
