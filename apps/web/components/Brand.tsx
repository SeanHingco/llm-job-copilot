// components/Brand.tsx
import Link from "next/link";
import Image from "next/image";

export default function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="Resume Bender home">
      <Image
        src="/favicon-32x32.png"            // or "/logo.png"
        alt="Resume Bender"
        width={20}
        height={20}
        priority
      />
      <span className="font-semibold tracking-tight text-neutral-900">Resume Bender</span>
    </Link>
  );
}
