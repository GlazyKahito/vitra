import "server-only";
import { ANALYTES } from "@/lib/analytes";
import { getConsoleStats, listRuns, RUN_STATUSES } from "@/lib/data/runs";
import { listSamples } from "@/lib/data/samples";
import { getCalibrationStatus, listModels } from "@/lib/data/calibration";
import { listDevices } from "@/lib/data/devices";
import { getSettings } from "@/lib/data/settings";

/** Upper bound passed to listSamples; at the cap the readout says "≥ N" instead of guessing. */
const SAMPLE_CAP = 1000;

export type CalState = "synthetic_only" | "experimental" | "validated" | "none";

/**
 * A plain, serialisable snapshot of the lab for the landing readout. Every number here is a count of
 * stored rows, taken through lib/data at request time. Nothing is estimated, interpolated or invented.
 */
export interface LabSnapshot {
  takenAt: string;
  samples: { total: number; capped: boolean; synthetic: number };
  runs: { total: number; last7d: number; synthetic: number; byStatus: { status: string; count: number }[] };
  review: { pending: number; reviewedLast7d: number };
  quality: { failuresLast30: number; recent: { runId: string; runCode: string; sampleCode: string; at: string; checks: string[] }[] };
  calibration: {
    productName: string | null;
    perAnalyte: { key: string; short: string; label: string; state: CalState; ageDays: number | null; recalibrationDue: boolean }[];
    models: { active: number; syntheticTrained: number; experimental: number; validated: number };
  };
  devices: { id: string; name: string; simulated: boolean; health: string; lastSeen: string | null }[];
  latest: { id: string; runCode: string; sampleCode: string; at: string; status: string; qualityPassed: boolean | null; synthetic: boolean; mode: string }[];
}

export async function getLabSnapshot(): Promise<LabSnapshot> {
  const [stats, latest, samples, calibration, models, devices, settings] = await Promise.all([
    getConsoleStats(),
    listRuns({ limit: 5 }),
    listSamples(undefined, { limit: SAMPLE_CAP }),
    getCalibrationStatus(),
    listModels(),
    listDevices(),
    getSettings(),
  ]);

  const product = calibration.find((c) => c.stripProductId === settings.defaultStripProductId) ?? calibration[0] ?? null;
  const active = models.filter((m) => m.model.status === "trained" || m.model.status === "validated");

  return {
    takenAt: new Date().toISOString(),
    samples: {
      total: samples.length,
      capped: samples.length >= SAMPLE_CAP,
      synthetic: samples.filter((s) => s.sample.synthetic).length,
    },
    runs: {
      total: stats.totalRuns,
      last7d: stats.runsLast7d,
      synthetic: stats.syntheticRuns,
      byStatus: RUN_STATUSES.map((s) => ({ status: s, count: stats.byStatus[s] ?? 0 })),
    },
    review: { pending: stats.pendingReview, reviewedLast7d: stats.reviewedLast7d },
    quality: {
      failuresLast30: stats.qualityFailuresLast30,
      recent: stats.recentQualityFailures.slice(0, 3).map((f) => ({
        runId: f.run.id,
        runCode: f.run.runCode,
        sampleCode: f.sample.sampleCode,
        at: f.run.createdAt.toISOString(),
        checks: f.failedChecks,
      })),
    },
    calibration: {
      productName: product?.stripProductName ?? null,
      perAnalyte: ANALYTES.map((a) => {
        const row = product?.perAnalyte.find((p) => p.analyteKey === a.key);
        return {
          key: a.key,
          short: a.short,
          label: a.label,
          state: (row?.status ?? "none") as CalState,
          ageDays: row?.ageDays ?? null,
          recalibrationDue: row?.recalibrationDue ?? false,
        };
      }),
      models: {
        active: active.length,
        syntheticTrained: active.filter((m) => m.model.status !== "validated" && m.model.trainedOnSynthetic).length,
        experimental: active.filter((m) => m.model.status !== "validated" && !m.model.trainedOnSynthetic).length,
        validated: active.filter((m) => m.model.status === "validated").length,
      },
    },
    devices: devices.map((d) => ({
      id: d.device.id,
      name: d.device.name,
      simulated: d.device.simulated || d.health === "simulated",
      health: d.health,
      lastSeen: d.device.lastSeenAt ? d.device.lastSeenAt.toISOString() : null,
    })),
    latest: latest.items.map(({ run, sample }) => ({
      id: run.id,
      runCode: run.runCode,
      sampleCode: sample.sampleCode,
      at: run.createdAt.toISOString(),
      status: run.status,
      qualityPassed: run.qualityPassed ?? null,
      synthetic: run.synthetic || sample.synthetic,
      mode: run.mode,
    })),
  };
}
