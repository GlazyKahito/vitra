import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { NewAnalysisWizard } from "@/components/analysis/new-analysis-wizard";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listSamples, nextSampleCode } from "@/lib/data/samples";
import { listStripProducts } from "@/lib/data/strips";
import { getSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "New analysis" };

export default async function NewAnalysisPage() {
  const user = await requireUser("runs.create");
  const [samples, products, suggested, settings] = await Promise.all([listSamples(undefined, { limit: 200 }), listStripProducts(), nextSampleCode(), getSettings()]);

  return (
    <AppShell
      user={user}
      eyebrow="02 / Capture"
      title="New analysis"
      onLogout={logoutAction}
      actions={
        <Button href="/console" variant="ghost" size="sm">
          Back to console
        </Button>
      }
    >
      {products.length === 0 ? (
        <div className="panel flex flex-col items-start gap-2 p-6">
          <div className="t-eyebrow">No strip product</div>
          <p className="text-[13px] text-fg-2">At least one strip product with a pad map is required before an analysis can be started.</p>
          <Button href="/strips" variant="secondary" size="sm">
            Configure strip products
          </Button>
        </div>
      ) : (
        <NewAnalysisWizard
          operatorLabel={user.displayName}
          samples={samples.map((s) => ({ id: s.sample.id, sampleCode: s.sample.sampleCode, subjectPseudonym: s.sample.subjectPseudonym, synthetic: s.sample.synthetic, runCount: s.runCount }))}
          stripProducts={products.map((p) => ({
            id: p.id,
            name: p.name,
            manufacturer: p.manufacturer,
            padMap: p.padMap,
            reactionSeconds: p.reactionSeconds,
            batches: p.batches.map((b) => ({ id: b.id, lotNumber: b.lotNumber, expiresOn: b.expiresOn })),
          }))}
          suggestedSampleCode={suggested}
          defaultStripProductId={settings.defaultStripProductId || null}
          demoModeEnabled={settings.demoModeEnabled}
        />
      )}
    </AppShell>
  );
}
