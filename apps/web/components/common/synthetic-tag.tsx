import { Chip, type ChipProps } from "@/components/ui/chip";

export interface SyntheticTagProps extends Omit<ChipProps, "tone" | "children"> {
  /** Longer label variants for different contexts. Default "synthetic". */
  variant?: "synthetic" | "synthetic-trained" | "simulated" | "synthetic-demo";
}

const LABELS: Record<NonNullable<SyntheticTagProps["variant"]>, { text: string; title: string }> = {
  synthetic: { text: "Synthetic", title: "Generated data. Not a real sample, measurement or device reading." },
  "synthetic-trained": { text: "Synthetic-trained", title: "This model was fitted on synthetic data. Its metrics describe the pipeline, not real-world performance." },
  simulated: { text: "Simulated", title: "Produced by the simulated device adapter. No hardware is connected." },
  "synthetic-demo": { text: "Synthetic demo", title: "Demo-mode value from a synthetic-data model. No clinical meaning." },
};

/** The one honest tag everything synthetic/simulated carries. Always muted, never a result colour. */
export function SyntheticTag({ variant = "synthetic", ...rest }: SyntheticTagProps) {
  const l = LABELS[variant];
  return (
    <Chip tone="muted" title={l.title} data-synthetic="true" {...rest}>
      {l.text}
    </Chip>
  );
}
