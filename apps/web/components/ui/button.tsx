import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform,opacity] duration-200 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-40 active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-signal text-ink-0 hover:bg-[#7ee0ef] border border-transparent",
        secondary: "bg-transparent text-fg border border-line-strong hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.03)]",
        ghost: "bg-transparent text-fg-2 border border-transparent hover:text-fg hover:bg-[rgba(255,255,255,0.04)]",
        danger: "bg-transparent text-fault border border-[rgba(224,108,108,0.35)] hover:bg-fault-dim",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-10 px-4 text-[13.5px]",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** When provided the button renders as a Next.js <Link>. */
  href?: string;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, href, loading, leading, trailing, children, disabled, type = "button", ...rest },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : leading}
      {children}
      {trailing}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || loading || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
});
