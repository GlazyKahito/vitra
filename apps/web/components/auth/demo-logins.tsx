"use client";

import { useActionState, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { loginAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export interface DemoAccount {
  role: "admin" | "clinician" | "operator" | "researcher";
  label: string;
  email: string;
  password: string;
  note: string;
}

/**
 * One-click sign-in for the seeded demo accounts. Each button submits the normal `loginAction`
 * (same validation, session and audit path as the form); nothing here bypasses authentication.
 * The page only renders this outside production or when demo logins are explicitly enabled.
 */
export function DemoLogins({ accounts, next }: { accounts: DemoAccount[]; next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [chosen, setChosen] = useState<string | null>(null);
  const reduce = useReducedMotion();

  return (
    <section aria-labelledby="demo-logins-title">
      <div className="flex items-center gap-3">
        <h2 id="demo-logins-title" className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/80">
          Demo accounts
        </h2>
        <span className="rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--lux-champagne)]">
          Synthetic
        </span>
        <span className="h-px flex-1 bg-[rgb(var(--lc-ivory-rgb)/0.1)]" aria-hidden />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--lux-platinum)]/45">one click</span>
      </div>
      <ul className="mt-3 grid grid-cols-4 gap-2">
        {accounts.map((a, i) => {
          const busy = pending && chosen === a.email;
          return (
            <motion.li
              key={a.email}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.32 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <form action={formAction} onSubmit={() => setChosen(a.email)}>
                <input type="hidden" name="email" value={a.email} />
                <input type="hidden" name="password" value={a.password} />
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={`Sign in as the demo ${a.label} (${a.email})`}
                  title={`${a.email} · ${a.note}`}
                  style={{ borderRadius: 12, outlineColor: "var(--lux-champagne)" }}
                  className={cn(
                    "group relative flex w-full flex-col items-start overflow-hidden rounded-[12px] border px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-300",
                    "border-[rgb(var(--lc-ivory-rgb)/0.1)] bg-[rgba(0,0,0,0.22)] hover:-translate-y-0.5 hover:border-[rgb(var(--lc-gold-rgb)/0.55)] hover:bg-[rgb(var(--lc-gold-rgb)/0.06)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lux-champagne)] disabled:cursor-progress",
                    busy && "border-[var(--lux-gold)]",
                  )}
                >
                  {busy ? (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgb(var(--lc-champagne-rgb)/0.18),transparent)]"
                      animate={{ x: ["0%", "400%"] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                  <span className="flex w-full items-baseline">
                    <span className="t-serif truncate text-[18px] leading-none text-[var(--lux-ivory)] transition-colors group-hover:text-[var(--lux-champagne)]">{a.label}</span>
                    <span className={cn("absolute right-2.5 top-2 font-mono text-[11px] text-[var(--lux-champagne)] transition-[opacity,transform] duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100", busy ? "opacity-100" : "opacity-0")} aria-hidden>
                      {busy ? "…" : "→"}
                    </span>
                  </span>
                  <span className="mt-1 truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--lux-platinum)]/55">{a.note}</span>
                </button>
              </form>
            </motion.li>
          );
        })}
      </ul>
      {state?.error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-[12.5px] text-fault">
          <span className="size-1.5 rounded-full bg-fault" aria-hidden />
          {state.error} The demo accounts exist only after <span className="font-mono">npm run db:seed</span>.
        </p>
      ) : null}
      <p className="mt-2.5 truncate text-[11px] text-[var(--lux-platinum)]/45">Fictional seeded accounts · all data synthetic · dev and demo instances only</p>
    </section>
  );
}
