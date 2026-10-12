import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { Chip, type ChipProps } from "./chip";

export interface StateChipProps extends Omit<ChipProps, "tone" | "children"> {
  state: ResultState;
  /** Show the long description as a native tooltip (title). Default true. */
  describe?: boolean;
}

/** Result-state chip — the one honest label every analyte result carries. */
export function StateChip({ state, describe = true, ...rest }: StateChipProps) {
  const meta = RESULT_STATE_META[state];
  return (
    <Chip tone={meta.tone} title={describe ? meta.description : undefined} data-state={state} {...rest}>
      {meta.label}
    </Chip>
  );
}
