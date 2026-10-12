import { describe, expect, it } from "vitest";
import { decideResult, runStatusFromStates, type ModelCandidate } from "@/lib/inference/policy";

const synthModel: ModelCandidate = { id: "glucose-poly2-v1", analyte: "glucose", stripProductId: "syn", version: "v1", status: "trained", trainedOnSynthetic: true, referenceRange: [0, 1000] };
const realModel: ModelCandidate = { ...synthModel, id: "glucose-real-v1", trainedOnSynthetic: false };
const validated: ModelCandidate = { ...realModel, id: "glucose-val-v1", status: "validated" };

describe("decideResult", () => {
  it("fails closed on image quality", () => {
    const d = decideResult({ analyte: "glucose", mode: "demo", imagePassed: false, pad: { status: "ok" }, model: synthModel, prediction: 100 });
    expect(d.state).toBe("invalid_image");
    expect(d.value).toBeNull();
  });
  it("marks failed pads indeterminate", () => {
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "fail" }, model: synthModel, prediction: 100 }).state).toBe("indeterminate");
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: null, model: synthModel, prediction: 100 }).state).toBe("indeterminate");
  });
  it("requires calibration when no usable model", () => {
    expect(decideResult({ analyte: "glucose", mode: "research", imagePassed: true, pad: { status: "ok" }, model: null, prediction: null }).state).toBe("calibration_required");
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: { ...synthModel, status: "retired" }, prediction: 10 }).state).toBe("calibration_required");
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: { ...synthModel, status: "draft" }, prediction: 10 }).state).toBe("calibration_required");
  });
  it("never shows synthetic-model numbers in research mode", () => {
    const d = decideResult({ analyte: "glucose", mode: "research", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: 120 });
    expect(d.state).toBe("calibration_required");
    expect(d.value).toBeNull();
  });
  it("labels synthetic-model values in demo mode", () => {
    const d = decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: 120 });
    expect(d.state).toBe("synthetic");
    expect(d.value).toBe(120);
  });
  it("reports unavailable on inference errors or missing predictions", () => {
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: null, inferenceError: "timeout" }).state).toBe("unavailable");
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: Number.NaN }).state).toBe("unavailable");
  });
  it("withholds values outside the calibrated range (2% tolerance)", () => {
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: 1015 }).state).toBe("synthetic");
    expect(decideResult({ analyte: "glucose", mode: "demo", imagePassed: true, pad: { status: "ok" }, model: synthModel, prediction: 1030 }).state).toBe("out_of_range");
  });
  it("distinguishes experimental from measured", () => {
    expect(decideResult({ analyte: "glucose", mode: "research", imagePassed: true, pad: { status: "warn" }, model: realModel, prediction: 300 }).state).toBe("experimental");
    expect(decideResult({ analyte: "glucose", mode: "research", imagePassed: true, pad: { status: "ok" }, model: validated, prediction: 300 }).state).toBe("measured");
  });
  it("clamps to the analyte span", () => {
    const d = decideResult({ analyte: "ph", mode: "research", imagePassed: true, pad: { status: "ok" }, model: { ...validated, analyte: "ph", referenceRange: null }, prediction: 12 });
    expect(d.value).toBe(9);
  });
});

describe("runStatusFromStates", () => {
  it("maps image failure", () => expect(runStatusFromStates(["invalid_image"], false)).toBe("invalid_image"));
  it("maps all calibration_required/unavailable", () => expect(runStatusFromStates(["calibration_required", "unavailable"], true)).toBe("calibration_required"));
  it("otherwise pending review", () => expect(runStatusFromStates(["calibration_required", "synthetic"], true)).toBe("pending_review"));
});
