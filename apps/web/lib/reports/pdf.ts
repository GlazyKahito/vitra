import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { buildReportJson, LIMITATIONS_TEXT, METHODOLOGY_TEXT, type ReportJson } from "@/lib/reports/json";
import type { RunDetail } from "@/lib/data/contract";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 40;
const INK = rgb(0.024, 0.024, 0.027);
const PAPER = rgb(1, 1, 1);
const FG = rgb(0.1, 0.1, 0.11);
const FG2 = rgb(0.4, 0.4, 0.43);
const LINE = rgb(0.82, 0.82, 0.84);
const SIGNAL = rgb(0.0, 0.62, 0.72);
const NOTICE = rgb(0.75, 0.5, 0.05);
const NOTICE_BG = rgb(0.99, 0.95, 0.85);
const MUTED_BG = rgb(0.94, 0.94, 0.95);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  helv: PDFFont;
  helvBold: PDFFont;
  mono: PDFFont;
  footer: string;
  pageNo: number;
}

function sanitize(s: string): string {
  // WinAnsi-safe: replace characters Helvetica cannot encode.
  return s.replace(/[—–]/g, "-").replace(/µ/g, "u").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) cur = candidate;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawFooter(ctx: Ctx): void {
  const { page, mono } = ctx;
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_W - MARGIN, y: 30 }, thickness: 0.5, color: LINE });
  page.drawText(sanitize(ctx.footer), { x: MARGIN, y: 18, size: 7, font: mono, color: FG2 });
  const pn = `page ${ctx.pageNo}`;
  page.drawText(pn, { x: PAGE_W - MARGIN - mono.widthOfTextAtSize(pn, 7), y: 18, size: 7, font: mono, color: FG2 });
}

function newPage(ctx: Ctx): void {
  drawFooter(ctx);
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNo += 1;
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < 48) newPage(ctx);
}

function text(ctx: Ctx, s: string, opts: { size?: number; font?: PDFFont; color?: RGB; x?: number; gap?: number } = {}): void {
  const size = opts.size ?? 9;
  const font = opts.font ?? ctx.helv;
  ensure(ctx, size + 4);
  ctx.page.drawText(sanitize(s), { x: opts.x ?? MARGIN, y: ctx.y - size, size, font, color: opts.color ?? FG });
  ctx.y -= size + (opts.gap ?? 4);
}

function paragraph(ctx: Ctx, s: string, size = 8.5, color: RGB = FG): void {
  for (const line of wrap(s, ctx.helv, size, PAGE_W - 2 * MARGIN)) text(ctx, line, { size, color, gap: 2.5 });
  ctx.y -= 4;
}

function eyebrow(ctx: Ctx, n: string, label: string): void {
  ctx.y -= 6;
  ensure(ctx, 24);
  ctx.page.drawText(sanitize(`${n} / ${label.toUpperCase()}`), { x: MARGIN, y: ctx.y - 8, size: 7.5, font: ctx.mono, color: SIGNAL });
  ctx.y -= 12;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_W - MARGIN, y: ctx.y }, thickness: 0.5, color: LINE });
  ctx.y -= 8;
}

function kv(ctx: Ctx, rows: [string, string][]): void {
  const colW = (PAGE_W - 2 * MARGIN) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    ensure(ctx, 20);
    for (let c = 0; c < 2; c++) {
      const r = rows[i + c];
      if (!r) continue;
      const x = MARGIN + c * colW;
      ctx.page.drawText(sanitize(r[0].toUpperCase()), { x, y: ctx.y - 7, size: 6.5, font: ctx.mono, color: FG2 });
      ctx.page.drawText(sanitize(r[1]), { x, y: ctx.y - 17, size: 8.5, font: ctx.helv, color: FG });
    }
    ctx.y -= 24;
  }
}

function banner(ctx: Ctx, label: string, bg: RGB, fg: RGB): void {
  ensure(ctx, 22);
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 18, width: PAGE_W - 2 * MARGIN, height: 18, color: bg });
  ctx.page.drawText(sanitize(label), { x: MARGIN + 8, y: ctx.y - 12.5, size: 7.5, font: ctx.mono, color: fg });
  ctx.y -= 24;
}

function table(ctx: Ctx, headers: string[], widths: number[], rows: string[][], size = 7.5): void {
  const rowH = size + 7;
  const drawHeader = () => {
    ensure(ctx, rowH * 2);
    let x = MARGIN;
    headers.forEach((h, i) => {
      ctx.page.drawText(sanitize(h.toUpperCase()), { x: x + 2, y: ctx.y - size - 1, size: 6.5, font: ctx.mono, color: FG2 });
      x += widths[i];
    });
    ctx.y -= rowH;
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y + 2 }, end: { x: PAGE_W - MARGIN, y: ctx.y + 2 }, thickness: 0.6, color: FG });
  };
  drawHeader();
  for (const row of rows) {
    if (ctx.y - rowH < 48) {
      newPage(ctx);
      drawHeader();
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const font = i === 0 ? ctx.helvBold : ctx.helv;
      let s = sanitize(cell);
      while (s.length > 1 && font.widthOfTextAtSize(s, size) > widths[i] - 4) s = s.slice(0, -1);
      ctx.page.drawText(s, { x: x + 2, y: ctx.y - size - 1, size, font, color: FG });
      x += widths[i];
    });
    ctx.y -= rowH;
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y + 2 }, end: { x: PAGE_W - MARGIN, y: ctx.y + 2 }, thickness: 0.3, color: LINE });
  }
  ctx.y -= 6;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

const PROVENANCE_LABEL: Record<ReportJson["results"][number]["provenance"], string> = {
  validated_model: "validated model",
  real_data_model: "real-data model (not validated)",
  synthetic_model: "SYNTHETIC-data model",
  none: "no model",
};

export async function renderReportPdf(detail: RunDetail, generatedBy: string, now = new Date()): Promise<Uint8Array> {
  const data = buildReportJson(detail, generatedBy, now);
  const doc = await PDFDocument.create();
  doc.setTitle(`VITRA analysis report ${data.run.run_code}`);
  doc.setProducer("VITRA research prototype");
  doc.setCreator("VITRA");
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = {
    doc,
    page,
    y: PAGE_H - MARGIN,
    helv,
    helvBold,
    mono,
    pageNo: 1,
    footer: `VITRA ${data.run.run_code} · pipeline ${data.pipeline_version ?? "n/a"} · generated ${fmtDate(data.generated_at)} · research prototype, not a medical device`,
  };

  /* dark header */
  page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: INK });
  page.drawText("VITRA", { x: MARGIN, y: PAGE_H - 40, size: 20, font: helvBold, color: PAPER });
  page.drawText("VITRA analysis report", { x: MARGIN, y: PAGE_H - 58, size: 10, font: helv, color: rgb(0.8, 0.8, 0.82) });
  page.drawText(sanitize(`RUN ${data.run.run_code}  ·  SAMPLE ${data.sample.sample_code}  ·  ${data.run.mode.toUpperCase()} MODE`), { x: MARGIN, y: PAGE_H - 76, size: 7.5, font: mono, color: SIGNAL });
  const stamp = sanitize(fmtDate(data.generated_at));
  page.drawText(stamp, { x: PAGE_W - MARGIN - mono.widthOfTextAtSize(stamp, 7.5), y: PAGE_H - 40, size: 7.5, font: mono, color: rgb(0.7, 0.7, 0.72) });
  ctx.y = PAGE_H - 92 - 14;

  banner(ctx, "RESEARCH PROTOTYPE - NOT A MEDICAL DEVICE - NOT CLINICALLY VALIDATED", NOTICE_BG, NOTICE);
  if (data.synthetic) banner(ctx, "SYNTHETIC DATA - this run and/or sample is computer-generated and has no clinical meaning", MUTED_BG, FG2);

  eyebrow(ctx, "01", "Identification");
  kv(ctx, [
    ["Run", data.run.run_code],
    ["Run id", data.run.id],
    ["Sample code", data.sample.sample_code],
    ["Subject pseudonym", data.sample.subject_pseudonym ?? "-"],
    ["Status", data.run.status],
    ["Mode", data.run.mode],
    ["Created", fmtDate(data.run.created_at)],
    ["Completed", fmtDate(data.run.completed_at)],
    ["Captured", fmtDate(data.run.captured_at)],
    ["Reaction time", data.run.reaction_seconds !== null ? `${data.run.reaction_seconds} s` : "-"],
    ["Image source", data.run.image_source],
    ["Device", data.device ? `${data.device.name}${data.device.simulated ? " (SIMULATED)" : ""}` : "-"],
    ["Operator", data.run.operator_label ?? "-"],
    ["Generated by", data.generated_by],
    ["Strip product", `${data.strip_product.manufacturer} - ${data.strip_product.name}`],
    ["Batch / lot", data.strip_batch ? `${data.strip_batch.lot_number}${data.strip_batch.expires_on ? ` (exp ${data.strip_batch.expires_on})` : ""}` : "-"],
    ["Image sha256", data.image ? data.image.sha256.slice(0, 32) + "..." : "-"],
    ["Pipeline", data.pipeline_version ?? "-"],
  ]);

  eyebrow(ctx, "02", "Analyte results");
  table(
    ctx,
    ["Analyte", "State", "Value", "Unit", "Scale", "Pad", "Pad q.", "Model", "Provenance"],
    [62, 86, 40, 36, 92, 26, 32, 76, 65],
    data.results.map((r) => [
      r.analyte_label,
      r.state_label,
      r.value_display,
      r.unit,
      r.chart_scale.join(" / "),
      r.pad_id ?? "-",
      r.pad_quality ?? "-",
      r.model_id ?? "-",
      PROVENANCE_LABEL[r.provenance],
    ]),
    7,
  );
  if (data.results.length === 0) paragraph(ctx, "No analyte results were produced for this run.", 8.5, FG2);

  eyebrow(ctx, "03", "Image quality checks");
  if (data.quality.checks.length) {
    table(
      ctx,
      ["Check", "Status", "Value", "Threshold", "Message"],
      [90, 44, 70, 90, 221],
      data.quality.checks.map((c) => [c.label, c.status, c.value === null ? "-" : String(c.value), c.threshold ?? "-", c.message]),
    );
  } else paragraph(ctx, "No quality checks recorded (run did not reach the CV service).", 8.5, FG2);
  if (data.run.error_message) paragraph(ctx, `Error: ${data.run.error_message}`, 8.5, NOTICE);

  eyebrow(ctx, "04", "Warnings");
  if (data.warnings.length) for (const w of data.warnings) paragraph(ctx, `- ${w}`, 8.5);
  else paragraph(ctx, "None.", 8.5, FG2);

  eyebrow(ctx, "05", "Review history");
  if (data.reviews.length) {
    table(ctx, ["When", "Reviewer", "Decision", "Note"], [110, 130, 70, 205], data.reviews.map((r) => [fmtDate(r.at), r.reviewer, r.decision, r.note ?? "-"]));
  } else paragraph(ctx, "No clinical review recorded.", 8.5, FG2);

  eyebrow(ctx, "06", "Methodology & limitations");
  paragraph(ctx, METHODOLOGY_TEXT);
  paragraph(ctx, LIMITATIONS_TEXT);
  paragraph(ctx, data.disclaimer, 8, FG2);

  drawFooter(ctx);
  return doc.save();
}
