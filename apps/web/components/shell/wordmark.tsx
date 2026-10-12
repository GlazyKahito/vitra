import Link from "next/link";
import { cn } from "@/lib/utils";

export interface WordmarkProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  /** Show the mono tag under the name. */
  tag?: boolean;
  className?: string;
}

/** VITRA wordmark: a cyan aperture mark + tight display type. */
export function Wordmark({ href = "/", size = "md", tag, className }: WordmarkProps) {
  const px = { sm: 14, md: 16, lg: 20 }[size];
  const text = { sm: "text-[14px]", md: "text-[16px]", lg: "text-[22px]" }[size];
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 text-fg no-underline", className)} aria-label="VITRA home">
      <svg width={px} height={px} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="15" height="15" rx="2" stroke="currentColor" strokeOpacity="0.5" />
        <rect x="4" y="4" width="8" height="8" rx="1" fill="var(--color-signal)" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-semibold tracking-[0.18em]", text)}>VITRA</span>
        {tag ? <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-4">Research prototype</span> : null}
      </span>
    </Link>
  );
}
