import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[7px] font-medium tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-40 active:translate-y-px",
  {
    variants: {
      variant: {
        /** Chrome emphasis: champagne/ivory fill. */
        primary:
          "ui-btn-primary border border-[rgba(255,248,230,0.5)] bg-[linear-gradient(180deg,#f2ebdd_0%,#e3d1a4_100%)] text-[#14120d] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_22px_-12px_rgba(201,169,110,0.65)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-12px_rgba(201,169,110,0.8)]",
        /** Instrument emphasis: the cyan data colour, for actions that act on signal/data. */
        signal: "border border-transparent bg-signal text-ink-0 hover:bg-[#7ee0ef]",
        secondary:
          "border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[rgba(201,169,110,0.42)] hover:text-[var(--lux-ivory)]",
        ghost: "border border-transparent bg-transparent text-fg-2 hover:bg-[rgba(255,255,255,0.045)] hover:text-fg",
        danger: "border border-[rgba(224,108,108,0.35)] bg-transparent text-fault hover:bg-fault-dim",
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
