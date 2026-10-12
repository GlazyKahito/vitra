import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Parses a headline string into words; `*word*` marks an italic serif word
 * (Instrument Serif italic). Asterisks may span several words: "*in large type.*"
 */
function parse(text: string): { w: string; em: boolean }[] {
  const out: { w: string; em: boolean }[] = [];
  let em: boolean = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let w = raw;
    let open: boolean = em;
    if (w.startsWith("*")) {
      open = true;
      w = w.slice(1);
    }
    let closeAfter = false;
    if (w.endsWith("*")) {
      closeAfter = true;
      w = w.slice(0, -1);
    }
    out.push({ w, em: open });
    em = closeAfter ? false : open;
  }
  return out;
}

/** Words wrapped in overflow masks; each inner span carries `data-w` for GSAP. */
export function SplitWords({ text, className, wordClassName }: { text: string; className?: string; wordClassName?: string }) {
  const words = parse(text);
  return (
    <span className={cn("lc-split", className)}>
      <span className="sr-only">{text.replace(/\*/g, "")}</span>
      <span aria-hidden>
        {words.map((t, i) => (
          <Fragment key={i}>
            <span className="word-mask">
              <span data-w className={cn(t.em && "italic", wordClassName)}>
                {t.w}
              </span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}

/** Letters in masks, words kept unbreakable. Each letter span carries `data-c`. */
export function SplitChars({ text, className }: { text: string; className?: string }) {
  const words = parse(text);
  return (
    <span className={className}>
      <span className="sr-only">{text.replace(/\*/g, "")}</span>
      <span aria-hidden>
        {words.map((t, i) => (
          <Fragment key={i}>
            <span className={cn("inline-block whitespace-nowrap", t.em && "italic")}>
              {Array.from(t.w).map((c, j) => (
                <span key={j} className="lc-char-mask">
                  <span data-c>{c}</span>
                </span>
              ))}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}
