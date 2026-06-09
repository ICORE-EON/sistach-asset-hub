import * as XLSX from "xlsx";

export type ParsedRow = Record<string, string>;

export interface ParsedFile {
  headers: string[];
  rows: ParsedRow[];
}

function normalizeHeader(h: string): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeRow(headers: string[], values: unknown[]): ParsedRow {
  const out: ParsedRow = {};
  headers.forEach((h, i) => {
    const raw = values[i];
    if (raw === null || raw === undefined) {
      out[h] = "";
    } else if (raw instanceof Date) {
      out[h] = raw.toISOString().slice(0, 10);
    } else {
      out[h] = String(raw).trim();
    }
  });
  return out;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = (matrix[0] as unknown[]).map((h) => normalizeHeader(String(h)));
  const rows: ParsedRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] as unknown[];
    if (!r || r.every((v) => v === "" || v === null || v === undefined)) continue;
    rows.push(normalizeRow(headers, r));
  }
  return { headers, rows };
}

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
