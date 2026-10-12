import { ChartFrame, LineChart } from "@/components/charts";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import type { ConsoleStats } from "@/lib/data/contract";

/**
 * Small multiples of stored analyte values across recent runs. Only analytes with
 * at least one reported value are shown; synthetic points are hollow markers.
 */
export function AnalyteMultiples({ series }: { series: ConsoleStats["analyteValueSeries"] }) {
  const withValues = series.filter((s) => s.points.length > 0);
  if (withValues.length === 0) {
    return (
      <div className="panel flex h-36 flex-col items-center justify-center gap-1">
        <span className="t-eyebrow">No analyte values stored</span>
        <span className="text-[12px] text-fg-4">Values appear once a calibration model produces a result (demo mode uses synthetic-data models).</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-3">
      {withValues.map((s) => {
        const def = isAnalyteKey(s.analyteKey) ? ANALYTE_BY_KEY[s.analyteKey] : null;
        const pts = s.points.slice(-24);
        const synthCount = pts.filter((p) => p.synthetic).length;
        return (
          <div key={s.analyteKey} className="panel p-4">
            <ChartFrame
              eyebrow={def?.short ?? s.analyteKey}
              title={def?.label ?? s.analyteKey}
              meta={s.unit}
              footnote={synthCount > 0 ? `${synthCount}/${pts.length} synthetic (hollow)` : `${pts.length} values`}
            >
              <LineChart
                width={260}
                height={110}
                showPoints
                yDomain={def && def.kind === "continuous" ? undefined : { min: 0, max: 1 }}
                series={[
                  {
                    id: s.analyteKey,
                    label: def?.label,
                    tone: "signal",
                    points: pts.map((p, i) => ({ x: i, y: p.value, synthetic: p.synthetic, state: p.state, label: p.runCode })),
                  },
                ]}
                xTicks={pts.length > 1 ? [{ x: 0, label: pts[0].runCode }, { x: pts.length - 1, label: pts[pts.length - 1].runCode }] : [{ x: 0, label: pts[0].runCode }]}
                yFormat={(v) => (def ? v.toFixed(def.decimals) : String(v))}
                ariaLabel={`${def?.label ?? s.analyteKey} values across recent runs`}
              />
            </ChartFrame>
          </div>
        );
      })}
    </div>
  );
}
