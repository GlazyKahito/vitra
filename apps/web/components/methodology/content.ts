export interface MethodStep {
  n: number;
  id: string;
  title: string;
  body: string;
}

export const METHOD_STEPS: MethodStep[] = [
  {
    n: 1,
    id: "step-1",
    title: "Sample and strip preparation",
    body: "A fresh, well-mixed urine sample is collected in a clean container. One reagent strip from a sealed, in-date vial is dipped so that all ten pads are wetted, then drawn along the rim to remove excess liquid. The strip product, lot number and expiry are recorded against the sample so a calibration model can be matched to the exact chemistry used.",
  },
  {
    n: 2,
    id: "step-2",
    title: "Timed reaction",
    body: "Pad colour develops over roughly 60–120 s and keeps changing afterwards. VITRA uses a fixed reaction window of 120 s from dip to capture, started by the operator on the device. Captures outside the window are flagged; there is no manual override of the timer in research mode.",
  },
  {
    n: 3,
    id: "step-3",
    title: "Controlled image acquisition",
    body: "The strip is inserted handle-first into the enclosure slot, which seats the pads at a known position under the camera. Brightness-regulated LED strips provide the only illumination; exposure, gain and white balance are locked. The Raspberry Pi 5 captures a single full-resolution frame and submits it with device identity, LED current and timer metadata.",
  },
  {
    n: 4,
    id: "step-4",
    title: "Image-quality validation",
    body: "Before any colour is read, the image is checked for focus (Laplacian variance), exposure (clipped-pixel fraction), glare (specular highlight area), tilt and completeness. A frame that fails is recorded with the reason and the run is stopped with the state “Invalid image”. No pad is analysed from a rejected frame.",
  },
  {
    n: 5,
    id: "step-5",
    title: "Strip localization",
    body: "OpenCV finds the strip body: adaptive thresholding, contour extraction and a minimum-area rectangle, followed by a perspective correction that rotates the strip to a canonical horizontal pose. Because the slot fixes the geometry, a fixed-geometry fallback can be used when the contour search fails, and the fallback is recorded in the run.",
  },
  {
    n: 6,
    id: "step-6",
    title: "Ten-pad segmentation",
    body: "Along the rectified strip the ten pads are found as regularly spaced high-saturation squares. Each pad region is shrunk by a margin to avoid the edges where dye bleeds, and the configured pad map assigns an analyte to each position. A pad whose region is too small, non-uniform or occluded is marked “Indeterminate”.",
  },
  {
    n: 7,
    id: "step-7",
    title: "RGB/CIELAB feature extraction",
    body: "For each pad VITRA records the trimmed mean and standard deviation of R, G and B, converts to CIE L*a*b* under a D65 assumption, and derives chroma and hue angle. Uniformity, glare fraction and local contrast become pad-quality scores. A white reference region on the strip handle, when present, provides a per-image normalisation term.",
  },
  {
    n: 8,
    id: "step-8",
    title: "Calibration",
    body: "A calibration model maps pad features to an analyte value for one strip product. The calibration studio accepts reference pairs (image features paired with laboratory values), fits scikit-learn baselines (ridge regression, gradient boosting, k-nearest neighbours) with cross-validation, and stores the model with its reference range and training provenance. Models trained on synthetic data are flagged and only usable in demo mode.",
  },
  {
    n: 9,
    id: "step-9",
    title: "Model inference",
    body: "At run time each analyte is matched to the best compatible model for the strip product. A result-state policy then decides what is shown: a value is only displayed when the image and pad passed quality checks, a model exists, and the prediction lies inside the model’s reference range. Otherwise the analyte carries a state such as “Calibration required” or “Outside calibrated range” and no number.",
  },
  {
    n: 10,
    id: "step-10",
    title: "Report generation",
    body: "A report bundles the capture, overlay, feature table, per-analyte states and values, model identifiers and versions, quality metrics, and the review trail into PDF and JSON. Every page of the PDF carries the research-prototype disclaimer; synthetic runs are watermarked.",
  },
  {
    n: 11,
    id: "step-11",
    title: "Human review",
    body: "A clinician or researcher opens the run, compares the overlay against the raw image, and either accepts, annotates or overrides each analyte with a recorded reason. Sign-off locks the run. Nothing in VITRA leaves the review queue automatically.",
  },
];

export interface MethodSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const METHOD_SECTIONS: MethodSection[] = [
  {
    id: "variability",
    title: "Sources of variability",
    paragraphs: ["Colour on a reagent pad is the product of chemistry, time, light and optics. Each of these moves the measured RGB independently of the analyte concentration."],
    bullets: [
      "Strip brand — different manufacturers use different dyes and pad substrates; a model is valid for one product only.",
      "Batch — lot-to-lot differences in reagent loading shift the ramp; lot numbers are recorded with every run.",
      "Lighting — colour temperature and intensity change hue and lightness; the enclosure removes ambient light but not LED variation.",
      "LED aging and drift — LED output falls and shifts with age and temperature; device-level drift tracking is part of the roadmap.",
      "Segmentation errors — a pad region that includes edge bleed or background biases the mean colour; margins and quality scores limit but do not remove this.",
    ],
  },
  {
    id: "reference-data",
    title: "Reference-data requirements",
    paragraphs: [
      "A calibration model is only as good as the paired data behind it. For each strip product and analyte VITRA expects reference pairs that cover the clinically relevant span, captured on the same device class under the same acquisition protocol, with laboratory values obtained by an accepted reference method and recorded with timestamps so the reaction window can be verified.",
      "VITRA ships with no real reference data. The seeded datasets are synthetic, generated from the demo colour ramps, and exist only to exercise the pipeline.",
    ],
  },
  {
    id: "limitations",
    title: "Model limitations and uncertainty",
    paragraphs: [
      "Colour-to-concentration mappings are non-linear and saturate at both ends of the chart. A model will extrapolate badly beyond its reference range, which is why out-of-range predictions are suppressed rather than displayed.",
      "Baseline models report cross-validated error on their training set; this is not a measure of clinical performance. Qualitative analytes (nitrite) are reported as categories. No model in VITRA estimates its own per-sample uncertainty yet; that is listed as future work.",
    ],
  },
  {
    id: "validation",
    title: "Clinical validation requirements",
    paragraphs: [
      "Before any output could be considered for clinical use, a prospective study would be required: a predefined protocol, an adequately sized sample across the intended population, comparison against laboratory reference methods, pre-registered accuracy and agreement metrics per analyte, and ethics approval. None of this has been done. VITRA’s result states make that status visible on every result.",
    ],
  },
  {
    id: "dpdp",
    title: "Patient-data protection (DPDP Act 2023)",
    paragraphs: [
      "The Digital Personal Data Protection Act, 2023 governs the processing of personal data in India. In VITRA, sample records are keyed by an internal identifier and the platform does not require patient-identifying fields. Where a deployment chooses to record them, the data fiduciary must establish lawful purpose and consent, limit retention, provide access and erasure, and secure the data. Images and reports are stored under access control and served only to authenticated users with the relevant permission.",
    ],
  },
  {
    id: "cdsco",
    title: "Regulatory context (CDSCO MDR 2017 — IVD)",
    paragraphs: [
      "Under the Medical Devices Rules, 2017 administered by the Central Drugs Standard Control Organisation, software that interprets in-vitro diagnostic results would be regulated as an IVD medical device and would require classification, a quality management system, and a licence before manufacture or sale. VITRA is not registered and makes no claim under these rules. It is a research prototype and must not be used for diagnosis or patient management.",
    ],
  },
];

export const ROADMAP = {
  implemented: [
    "Image upload and in-browser capture",
    "Whole-image quality checks (focus, exposure, glare, tilt)",
    "OpenCV strip localisation and pad detection with fixed-geometry fallback",
    "RGB / CIELAB feature extraction with pad-quality scores",
    "Calibration studio with scikit-learn baselines",
    "Policy-driven result states on every analyte",
    "PDF / JSON report generation",
    "Review queue with overrides and sign-off",
    "Simulated device adapter and ingest API",
  ],
  future: [
    "Raspberry Pi capture integration on the enclosure",
    "MobileSAM / learned segmentation",
    "Real reference datasets per strip product",
    "Clinical validation study",
    "Optional LLM narration of reports",
  ],
} as const;
