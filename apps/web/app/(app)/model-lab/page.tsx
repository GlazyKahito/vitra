import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listModels, getModel } from "@/lib/data/calibration";
import { PrototypeBanner } from "@/components/common/prototype-banner";
import { ModelsTable } from "@/components/model-lab/models-table";
import { ModelDetail } from "@/components/model-lab/model-detail";
import { ModelCompare } from "@/components/model-lab/model-compare";

export const dynamic = "force-dynamic";

export default async function ModelLabPage({ searchParams }: { searchParams: Promise<{ model?: string; compare?: string; analyte?: string }> }) {
  const user = await requireUser("runs.read");
  const { model: modelId, compare: compareId, analyte } = await searchParams;
  const canManage = can(user, "calibration.manage");
  const canValidate = can(user, "models.validate");

  const [models, selected, compared] = await Promise.all([
    listModels(analyte ? { analyteKey: analyte } : undefined),
    modelId ? getModel(modelId) : Promise.resolve(null),
    modelId && compareId && compareId !== modelId ? getModel(compareId) : Promise.resolve(null),
  ]);

  const syntheticCount = models.filter((m) => m.model.trainedOnSynthetic).length;
  const validatedCount = models.filter((m) => m.model.status === "validated").length;

  return (
    <AppShell
      user={{ displayName: user.displayName, roleKey: user.roleKey }}
      eyebrow="09 / Model Lab"
      title="Model evaluation"
      actions={
        <Button href="/calibration" variant="secondary" size="sm">
          Calibration Studio
        </Button>
      }
      onLogout={logoutAction}
    >
      <div className="flex flex-col gap-6">
        <PrototypeBanner variant="inline" detail={`${models.length} model${models.length === 1 ? "" : "s"} · ${syntheticCount} synthetic-trained · ${validatedCount} validated. Metrics from synthetic datasets never describe real-world accuracy.`} />

        {modelId && !selected ? (
          <Panel eyebrow="Model" title="Not found">
            <p className="text-[12.5px] text-fg-3">
              No model with id <span className="t-mono">{modelId}</span>.
            </p>
          </Panel>
        ) : null}
        {selected && compareId && !compared && compareId !== modelId ? (
          <Panel eyebrow="Compare" title="Second model not found">
            <p className="text-[12.5px] text-fg-3">
              No model with id <span className="t-mono">{compareId}</span>.
            </p>
          </Panel>
        ) : null}

        {selected && compared ? <ModelCompare a={selected} b={compared} /> : null}
        {selected && !compared ? <ModelDetail m={selected} canManage={canManage} canValidate={canValidate} /> : null}

        <Panel eyebrow="Models" title="All calibration models" description={selected ? "Pick “compare” on another row to overlay it against the selected model." : "Select a model to inspect its evaluation."} flush>
          <ModelsTable models={models} selectedId={selected?.model.id} compareId={compared?.model.id} />
        </Panel>

        <PrototypeBanner />
      </div>
    </AppShell>
  );
}
