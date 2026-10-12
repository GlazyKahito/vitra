"use client";

import { useActionState, useId, useState, type InputHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { loginAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  /** Path to return to after sign-in (from ?next=). */
  next?: string;
}

/** Email / password sign-in through the existing `loginAction` server action. */
export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const errorId = useId();
  const error = state?.error;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate aria-describedby={error ? errorId : undefined}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FloatingField id="login-email" name="email" type="email" label="Email" autoComplete="username" required invalid={Boolean(error)} spellCheck={false} />
      <FloatingField id="login-password" name="password" type="password" label="Password" autoComplete="current-password" required invalid={Boolean(error)} />

      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key={error}
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[13px] text-fault"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-fault" aria-hidden />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <SubmitButton pending={pending} />
    </form>
  );
}

function FloatingField({ id, label, invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; invalid?: boolean }) {
  // Controlled, so React 19's post-action form reset does not wipe what the user typed.
  const [value, setValue] = useState("");
  return (
    <div className="relative">
      <input
        id={id}
        placeholder=" "
        aria-invalid={invalid || undefined}
        value={value}
        // the global :focus-visible rule is unlayered, so the champagne ring lives in box-shadow and this wins
        style={{ outline: "none", borderRadius: 13 }}
        onChange={(e) => setValue(e.currentTarget.value)}
        className={cn(
          "peer block h-[50px] w-full rounded-[13px] border bg-[rgba(0,0,0,0.28)] px-4 pb-[5px] pt-[19px] font-mono text-[14px] text-[var(--lux-ivory)] outline-none focus-visible:outline-none transition-[border-color,box-shadow,background-color] duration-300",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] placeholder:text-transparent",
          invalid
            ? "border-fault/60 focus:border-fault focus:shadow-[0_0_0_3px_rgba(224,108,108,0.18),inset_0_1px_2px_rgba(0,0,0,0.5)]"
            : "border-[rgb(var(--lc-ivory-rgb)/0.12)] hover:border-[rgb(var(--lc-ivory-rgb)/0.22)] focus:border-[var(--lux-gold)] focus:bg-[rgba(0,0,0,0.36)] focus:shadow-[0_0_0_3px_rgb(var(--lc-gold-rgb)/0.2),inset_0_1px_2px_rgba(0,0,0,0.5)]",
          className,
        )}
        {...rest}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute left-4 origin-left font-mono uppercase transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "top-[7px] text-[9.5px] tracking-[0.18em] text-[var(--lux-platinum)]/70",
          "peer-placeholder-shown:top-[16px] peer-placeholder-shown:text-[12px] peer-placeholder-shown:tracking-[0.14em] peer-placeholder-shown:text-[var(--lux-platinum)]/55",
          "peer-focus:top-[7px] peer-focus:text-[9.5px] peer-focus:tracking-[0.18em] peer-focus:text-[var(--lux-champagne)]",
        )}
      >
        {label}
      </label>
    </div>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      style={{ borderRadius: 9999, outlineColor: "var(--lux-champagne)" }}
      className={cn(
        "group relative mt-1 flex h-[50px] w-full items-center justify-between overflow-hidden rounded-full pl-6 pr-2 text-[15px] tracking-[-0.01em] text-[var(--lux-onyx)]",
        "bg-[linear-gradient(180deg,var(--lux-champagne),var(--lux-gold))] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_-16px_rgba(201,169,110,0.55)]",
        "transition-[transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-progress disabled:hover:translate-y-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lux-champagne)]",
      )}
    >
      {/* loading shimmer */}
      {pending ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <motion.span
            className="absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]"
            animate={{ x: ["0%", "400%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      ) : null}
      <span className="relative font-medium">{pending ? "Authenticating…" : "Sign in"}</span>
      <span className="relative grid size-9 place-items-center rounded-full bg-[var(--lux-onyx)] text-[var(--lux-champagne)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-rotate-45">
        {pending ? <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-[var(--lux-champagne)] border-t-transparent" aria-hidden /> : <span aria-hidden>→</span>}
      </span>
    </button>
  );
}
