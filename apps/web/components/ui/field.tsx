import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-3 text-[13.5px] text-fg placeholder:text-fg-4 transition-colors duration-200 hover:border-[rgba(255,255,255,0.24)] focus:border-signal focus:outline-none disabled:opacity-40 aria-[invalid=true]:border-fault";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: ReactNode;
  required?: boolean;
}

export function Label({ className, children, hint, required, ...rest }: LabelProps) {
  return (
    <label className={cn("flex items-baseline justify-between text-[12.5px] font-medium text-fg-2", className)} {...rest}>
      <span>
        {children}
        {required ? <span className="ml-1 text-notice">*</span> : null}
      </span>
      {hint ? <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4">{hint}</span> : null}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, mono, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, "h-10", mono && "font-mono tabular-nums", className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, mono, invalid, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(controlBase, "py-2.5 leading-relaxed", mono && "font-mono", className)} {...rest} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, "h-10 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
    </span>
  );
});

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + help/error stack. */
export function Field({ label, htmlFor, hint, help, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} hint={hint} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[12px] text-fault" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-[12px] text-fg-3">{help}</p>
      ) : null}
    </div>
  );
}
