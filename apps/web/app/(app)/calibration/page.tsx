import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listStripProducts } from "@/lib/data/strips";
import { listDatasets, getDataset, getCalibrationStatus } from "@/lib/data/calibration";
import { getSettings } from "@/lib/data/settings";
import { formatDateTime, shortId } from "@/lib/utils";
import { PrototypeBanner } from "@/components/common/prototype-banner";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { PadMapEditor } from "@/components/calibration/pad-map-editor";
import { DatasetImport } from "@/components/calibration/dataset-import";
import { DatasetDetail } from "@/components/calibration/dataset-detail";
import { TrainModelForm } from "@/components/calibration/train-model-form";
import { CalibrationStatusPanel } from "@/components/calibration/calibration-status";

export const dynamic = "force-dynamic";

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ dataset?: string }> }) {
  // Viewing requires calibration.manage per the brief; the editors additionally check the same permission.
  const user = await requireUser("calibration.manage");
  const canManage = can(user, "calibration.manage");
  // updateStripProductAction is gated on calibration.manage (app/actions/strips.ts).
  const canEditProduct = can(user, "calibration.manage");
  const { dataset: datasetId } = await searchParams;

  const [products, datasets, statuses, settings] = await Promise.all([listStripProducts(), listDatasets(), getCalibrationStatus(), getSettings()]);
  const selected = datasetId ? await getDataset(datasetId) : null;
  const productById = new Map(products.map((p) => [p.id, p] as const));

  const datasetsForTrain = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    version: d.version,
    stripProductId: d.stripProductId,
    synthetic: d.synthetic,
    rowCount: d.rowCount,
    perAnalyteCounts: ((d.validation ?? {}) as { per_analyte_counts?: Record<string, number> }).per_analyte_counts ?? null,
  }));

  return (
    <AppShell
      user={{ displayName: user.displayName, roleKey: user.roleKey }}
      eyebrow="08 / Calibration"
      title="Calibration Studio"
      actions={
        <Button href="/model-lab" variant="secondary" size="sm">
          Model Lab
        </Button>
      }
      onLogout={logoutAction}
    >
      <div className="flex flex-col gap-6">
        <PrototypeBanner variant="inline" detail="No seeded model is validated. Every number produced from a synthetic dataset is a pipeline demonstration, not a measurement." />

        <div className="grid grid-cols-[320px_minmax(0,1fr)_340px] items-start gap-5">
          {/* Left: strip products */}
          <div className="flex flex-col gap-4">
            {products.length === 0 ? (
              <Panel eyebrow="Strip products" title="None configured">
                <p className="text-[12.5px] text-fg-3">Seed a strip product before importing datasets.</p>
              </Panel>
            ) : null}
            {products.map((p) => (
              <Panel
                key={p.id}
                eyebrow="Strip product"
                title={p.name}
                description={
                  p.batches.length === 0 ? (
                    "No batches recorded."
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {p.batches.map((b) => (
                        <Chip key={b.id} tone="neutral" title={`received ${b.receivedOn ?? "—"} · expires ${b.expiresOn ?? "—"}`}>
                          lot {b.lotNumber}
                        </Chip>
                      ))}
                    </span>
                  )
                }
              >
                <PadMapEditor
                  product={{ id: p.id, name: p.name, manufacturer: p.manufacturer, padCount: p.padCount, padMap: p.padMap, reactionSeconds: p.reactionSeconds, geometry: p.geometry ?? null, notes: p.notes }}
                  canEdit={canEditProduct}
                />
              </Panel>
            ))}
          </div>

          {/* Centre: datasets */}
          <div className="flex min-w-0 flex-col gap-4">
            {selected ? <DatasetDetail dataset={selected} product={productById.get(selected.stripProductId) ?? null} /> : null}
            {datasetId && !selected ? (
              <Panel eyebrow="Dataset" title="Not found">
                <p className="text-[12.5px] text-fg-3">
                  No dataset with id <span className="t-mono">{datasetId}</span>.{" "}
                  <Link href="/calibration" className="text-signal">
                    Clear selection
                  </Link>
                </p>
              </Panel>
            ) : null}

            <Panel eyebrow="Datasets" title={`${datasets.length} imported`} flush>
              {datasets.length === 0 ? (
                <p className="px-5 py-6 text-[12.5px] text-fg-4">No datasets yet. Import a CSV below.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="table-instrument ws-compact">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Ver</th>
                      <th>Product</th>
                      <th>Kind</th>
                      <th>Rows</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((d) => (
                      <tr key={d.id} className={d.id === selected?.id ? "bg-[rgba(95,212,230,0.05)]" : undefined}>
                        <td>
                          <Link href={`/calibration?dataset=${encodeURIComponent(d.id)}`} className="text-fg hover:text-signal">
                            {d.name}
                          </Link>
                          <div className="t-mono text-[10.5px] text-fg-4">{shortId(d.id, 12)}</div>
                        </td>
                        <td className="t-mono">v{d.version}</td>
                        <td>{productById.get(d.stripProductId)?.name ?? shortId(d.stripProductId)}</td>
                        <td>{d.synthetic ? <SyntheticTag /> : <Chip tone="neutral">real</Chip>}</td>
                        <td className="t-mono">{d.rowCount}</td>
                        <td className="t-mono text-[12px]">{formatDateTime(d.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Panel>

            <Panel eyebrow="Import" title="Import calibration dataset" description="CSV per docs/cv-service-contract.md. The file is validated client-side for immediate feedback, then by the CV service on import.">
              <DatasetImport products={products.map((p) => ({ id: p.id, name: p.name, batches: p.batches.map((b) => ({ id: b.id, lotNumber: b.lotNumber })) }))} canImport={canManage} />
            </Panel>
          </div>

          {/* Right: status + train */}
          <div className="flex flex-col gap-4">
            <Panel eyebrow="Status" title="Calibration status per analyte">
              <CalibrationStatusPanel statuses={statuses} recalibrationIntervalDays={settings.recalibrationIntervalDays} />
            </Panel>
            <Panel eyebrow="Train" title="Train a calibration model" description="Fits on the CV service; the model is stored as draft/trained, never validated automatically.">
              <TrainModelForm datasets={datasetsForTrain} products={products.map((p) => ({ id: p.id, name: p.name, padMap: p.padMap }))} canTrain={canManage} initialDatasetId={selected?.id} />
            </Panel>
          </div>
        </div>

        <PrototypeBanner />
      </div>
    </AppShell>
  );
}
