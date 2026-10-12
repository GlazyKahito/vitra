import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Scroll wrapper + instrument table styling (see .table-instrument in globals.css). */
export function Table({ className, children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("table-instrument", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...rest} />;
}
export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}
export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...rest} />;
}
export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}
export function TH({ className, numeric, ...rest }: THProps) {
  return <th className={cn(numeric && "text-right", className)} {...rest} />;
}
export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  mono?: boolean;
}
export function TD({ className, numeric, mono, ...rest }: TDProps) {
  return <td className={cn(numeric && "text-right tabular-nums", mono && "font-mono text-[12.5px]", className)} {...rest} />;
}
