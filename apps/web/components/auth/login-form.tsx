"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  /** Path to return to after sign-in (from ?next=). */
  next?: string;
}

/** Demo accounts seeded by `db:seed`. Passwords are the SEED_*_PASSWORD values in .env.example. */
export const DEMO_ACCOUNTS = [
  { email: "admin@vitra.local", role: "admin", password: "vitra-admin", note: "Full access, model validation" },
  { email: "clinician@vitra.local", role: "clinician", password: "vitra-clinician", note: "Review, override, sign-off" },
  { email: "operator@vitra.local", role: "operator", password: "vitra-operator", note: "Capture and submit runs" },
  { email: "researcher@vitra.local", role: "researcher", password: "vitra-researcher", note: "Calibration and model lab" },
] as const;

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fill = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="w-[420px]">
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="Email" htmlFor="login-email" hint="operator id">
          <Input id="login-email" name="email" type="email" autoComplete="username" required mono value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@vitra.local" invalid={Boolean(state?.error)} />
        </Field>
        <Field label="Password" htmlFor="login-password" error={state?.error}>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required mono value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" invalid={Boolean(state?.error)} />
        </Field>
        <Button type="submit" size="lg" loading={pending} trailing={pending ? undefined : <ArrowRight className="size-4" />} className="mt-1 w-full">
          {pending ? "Authenticating" : "Sign in"}
        </Button>
      </form>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="t-eyebrow">Demo accounts</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">dev seed · click to fill</span>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.email}>
              <button
                type="button"
                onClick={() => fill(acc)}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto] items-center gap-4 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.025)]",
                  email === acc.email && "bg-[rgba(95,212,230,0.05)]",
                )}
              >
                <span>
                  <span className="block font-mono text-[12.5px] text-fg">{acc.email}</span>
                  <span className="block text-[11.5px] text-fg-4">{acc.note}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">{acc.role}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-fg-4">
          Passwords are the <span className="font-mono">SEED_*_PASSWORD</span> values from <span className="font-mono">.env.example</span>. Change them before any shared deployment.
        </p>
      </div>
    </div>
  );
}
