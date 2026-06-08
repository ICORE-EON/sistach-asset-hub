import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import type { CertificateTemplate, TemplateColumn } from "./certificate-templates/types";
import { renderTemplate, resolveCell, type RowSource } from "./certificate-templates/render";
import type { TemplateVariables } from "./certificate-templates/types";

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 50;

// Sanitize for WinAnsi (Helvetica). Replaces unsupported chars with closest equivalents.
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF]/g, "?"); // any remaining non-WinAnsi -> ?
}

interface DrawCtx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pdf: PDFDocument;
}

function newPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage([PAGE_W, PAGE_H]);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function ensureSpace(ctx: DrawCtx, needed: number): DrawCtx {
  if (ctx.y - needed < MARGIN) {
    const page = newPage(ctx.pdf);
    return { ...ctx, page, y: PAGE_H - MARGIN };
  }
  return ctx;
}

function drawParagraph(ctx: DrawCtx, text: string, size = 10, font?: PDFFont, lineHeight = 1.35): DrawCtx {
  const f = font ?? ctx.font;
  const maxWidth = PAGE_W - MARGIN * 2;
  const lines = wrapText(sanitize(text), f, size, maxWidth);
  let cur = ctx;
  for (const line of lines) {
    cur = ensureSpace(cur, size * lineHeight);
    cur.page.drawText(line, {
      x: MARGIN,
      y: cur.y - size,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.15),
    });
    cur = { ...cur, y: cur.y - size * lineHeight };
  }
  return cur;
}

function drawTable(
  ctx: DrawCtx,
  columns: TemplateColumn[],
  rows: RowSource[],
): DrawCtx {
  const tableWidth = PAGE_W - MARGIN * 2;
  const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const colWidths = columns.map((c) => (tableWidth * (c.width ?? 1)) / totalWeight);

  const headerSize = 9;
  const cellSize = 9;
  const headerH = 20;
  const cellPadding = 4;

  // Header
  let cur = ensureSpace(ctx, headerH + 4);
  cur.page.drawRectangle({
    x: MARGIN,
    y: cur.y - headerH,
    width: tableWidth,
    height: headerH,
    color: rgb(0.93, 0.94, 0.97),
  });
  let x = MARGIN;
  columns.forEach((c, idx) => {
    cur.page.drawText(sanitize(c.label), {
      x: x + cellPadding,
      y: cur.y - headerH + 6,
      size: headerSize,
      font: cur.bold,
      color: rgb(0.1, 0.1, 0.15),
    });
    x += colWidths[idx];
  });
  cur = { ...cur, y: cur.y - headerH };

  // Rows
  for (const row of rows) {
    const cells = columns.map((c) => sanitize(resolveCell(c, row) || ""));
    const wrapped = cells.map((text, idx) =>
      wrapText(text, cur.font, cellSize, colWidths[idx] - cellPadding * 2),
    );
    const lines = Math.max(1, ...wrapped.map((w) => w.length));
    const rowH = lines * (cellSize * 1.25) + cellPadding * 2;

    cur = ensureSpace(cur, rowH);
    // borders
    cur.page.drawRectangle({
      x: MARGIN,
      y: cur.y - rowH,
      width: tableWidth,
      height: rowH,
      borderColor: rgb(0.8, 0.82, 0.87),
      borderWidth: 0.5,
    });
    let cx = MARGIN;
    cells.forEach((_, idx) => {
      const w = wrapped[idx];
      w.forEach((line, li) => {
        cur.page.drawText(line, {
          x: cx + cellPadding,
          y: cur.y - cellPadding - cellSize * (li + 1) + 2,
          size: cellSize,
          font: cur.font,
          color: rgb(0.15, 0.15, 0.2),
        });
      });
      cx += colWidths[idx];
    });
    cur = { ...cur, y: cur.y - rowH };
  }

  return { ...cur, y: cur.y - 8 };
}

async function embedDataUrl(pdf: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  try {
    const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
    if (!match) return null;
    const bytes = Uint8Array.from(atob(match[3]), (c) => c.charCodeAt(0));
    return match[2].toLowerCase() === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

async function embedUrl(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("png")) return await pdf.embedPng(buf);
    if (ct.includes("jpeg") || ct.includes("jpg")) return await pdf.embedJpg(buf);
    // try png then jpg
    try { return await pdf.embedPng(buf); } catch { /* noop */ }
    try { return await pdf.embedJpg(buf); } catch { /* noop */ }
    return null;
  } catch {
    return null;
  }
}

export interface IncidentRow {
  asset_type?: string | null;
  asset_code?: string | null;
  location?: string | null;
  severity?: string | null;
  description?: string | null;
}

export interface BuildPdfInput {
  template: CertificateTemplate;
  vars: Partial<TemplateVariables>;
  rows: RowSource[];
  incidents?: IncidentRow[];
  logoUrl?: string | null;
  signatureDataUrl?: string | null;
}

export async function buildCertificatePdf(input: BuildPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = newPage(pdf);
  let ctx: DrawCtx = { pdf, page, font, bold, y: PAGE_H - MARGIN };

  // Logo (top right)
  if (input.template.show_logo && input.logoUrl) {
    const img = await embedUrl(pdf, input.logoUrl);
    if (img) {
      const maxH = 50;
      const scale = maxH / img.height;
      const w = img.width * scale;
      ctx.page.drawImage(img, {
        x: PAGE_W - MARGIN - w,
        y: PAGE_H - MARGIN - maxH,
        width: w,
        height: maxH,
      });
    }
  }

  const rendered = renderTemplate(input.template, input.vars);

  // Title
  ctx = ensureSpace(ctx, 30);
  ctx.page.drawText(sanitize(rendered.title), {
    x: MARGIN,
    y: ctx.y - 20,
    size: 18,
    font: bold,
    color: rgb(0.08, 0.1, 0.2),
  });
  ctx = { ...ctx, y: ctx.y - 32 };

  // Intro
  if (rendered.intro.trim()) {
    ctx = drawParagraph(ctx, rendered.intro, 10);
    ctx = { ...ctx, y: ctx.y - 6 };
  }

  // Regulation
  if (rendered.regulation.trim()) {
    ctx = drawParagraph(ctx, rendered.regulation, 9);
    ctx = { ...ctx, y: ctx.y - 6 };
  }

  // Table
  if (input.template.columns.length > 0 && input.rows.length > 0) {
    ctx = drawTable(ctx, input.template.columns, input.rows);
  }

  // Footer text
  if (rendered.footer.trim()) {
    ctx = { ...ctx, y: ctx.y - 10 };
    ctx = drawParagraph(ctx, rendered.footer, 10);
  }

  // Signature
  if (input.template.show_signature && input.signatureDataUrl) {
    ctx = ensureSpace(ctx, 100);
    ctx = { ...ctx, y: ctx.y - 20 };
    ctx.page.drawText(sanitize("Firma:"), {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.1, 0.15),
    });
    const sig = await embedDataUrl(pdf, input.signatureDataUrl);
    if (sig) {
      const maxH = 70;
      const scale = Math.min(maxH / sig.height, 200 / sig.width);
      ctx.page.drawImage(sig, {
        x: MARGIN,
        y: ctx.y - maxH - 4,
        width: sig.width * scale,
        height: sig.height * scale,
      });
    }
  }

  // Footer (page number)
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    const label = sanitize(`Página ${i + 1} de ${total} · ${input.vars.cert_code ?? ""}`);
    p.drawText(label, {
      x: MARGIN,
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.55),
    });
  });

  return await pdf.save();
}
