import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MtrEquipment } from "../../contracts/metrology";
import { displayStatus } from "../../domain/metrology";
import { today } from "./metrology-common";

type Fmt = "mini" | "standard" | "round" | "full";
const FORMATS: Record<Fmt, { label: string; w: number; h: number; round?: boolean }> = {
  mini: { label: "Mini · 30 × 15 mm", w: 30, h: 15 },
  standard: { label: "Estándar · 50 × 25 mm", w: 50, h: 25 },
  round: { label: "Circular · Ø 30 mm", w: 30, h: 30, round: true },
  full: { label: "Completa · 60 × 40 mm", w: 60, h: 40 },
};

/** Colores fijos de impresión (la etiqueta física no depende del tema de la app). */
function statusOf(e: MtrEquipment, nextDue: string | null) {
  const s = displayStatus(e.status, nextDue, today());
  if (s === "restricted") return { icon: "!", text: "RESTRINGIDO", color: "#d97706" };
  if (s === "operational" || s === "due_soon") return { icon: "✓", text: "APTO", color: "#16a34a" };
  if (s === "overdue") return { icon: "✕", text: "VENCIDO", color: "#dc2626" };
  return { icon: "✕", text: "NO APTO", color: "#dc2626" };
}
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

function LabelView({ e, nextDue, fmt, url }: { e: MtrEquipment; nextDue: string | null; fmt: Fmt; url: string }) {
  const f = FORMATS[fmt];
  const st = statusOf(e, nextDue);
  const mm = (n: number) => `${n}mm`;
  const badge = (size: number) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6mm", color: st.color, fontWeight: 700, fontSize: mm(size) }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: mm(size * 1.5), height: mm(size * 1.5), borderRadius: "50%", background: st.color, color: "#fff", fontSize: mm(size) }}>{st.icon}</span>
      {st.text}
    </span>
  );
  const base: React.CSSProperties = { width: mm(f.w), height: mm(f.h), boxSizing: "border-box", background: "#fff", color: "#000", fontFamily: "Arial, sans-serif", overflow: "hidden", lineHeight: 1.1 };

  if (f.round) {
    return (
      <div style={{ ...base, borderRadius: "50%", border: `1.2mm solid ${st.color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4mm", textAlign: "center" }}>
        {badge(1.8)}
        <QRCodeSVG value={url} size={60} level="L" style={{ width: "12mm", height: "12mm" }} />
        <div style={{ fontSize: "2mm", fontWeight: 700 }}>{e.code}</div>
        <div style={{ fontSize: "1.6mm" }}>Próx: {fmtDate(nextDue)}</div>
      </div>
    );
  }
  const qr = fmt === "mini" ? 12 : fmt === "standard" ? 21 : 26;
  const fs = fmt === "mini" ? 1.7 : fmt === "standard" ? 2.6 : 3;
  return (
    <div style={{ ...base, border: "0.3mm solid #000", borderLeft: `1.5mm solid ${st.color}`, display: "flex", alignItems: "center", gap: "1.2mm", padding: "1mm" }}>
      <QRCodeSVG value={url} size={120} level="M" style={{ width: mm(qr), height: mm(qr), flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: mm(fs * 0.3), minWidth: 0 }}>
        <div style={{ fontSize: mm(fs * 1.15), fontWeight: 700, whiteSpace: "nowrap" }}>{e.code}</div>
        <div style={{ fontSize: mm(fs), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.equipmentType}</div>
        {fmt === "full" && <>
          <div style={{ fontSize: mm(fs * 0.85) }}>{[e.brand, e.model].filter(Boolean).join(" ") || "—"}</div>
          <div style={{ fontSize: mm(fs * 0.85) }}>S/N: {e.serialNumber ?? "—"}</div>
        </>}
        <div style={{ fontSize: mm(fs) }}>Próx.: <b>{fmtDate(nextDue)}</b></div>
        {badge(fs * 0.9)}
      </div>
    </div>
  );
}

export function MetrologyLabelDialog({ open, onOpenChange, equipment, nextDue }: { open: boolean; onOpenChange: (o: boolean) => void; equipment: MtrEquipment; nextDue: string | null }) {
  const [fmt, setFmt] = useState<Fmt>("standard");
  const ref = useRef<HTMLDivElement>(null);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/metrology/equipment/${equipment.id}`;

  const print = () => {
    const f = FORMATS[fmt];
    const w = window.open("", "_blank", "width=600,height=500");
    if (!w || !ref.current) return;
    w.document.write(`<!doctype html><html><head><title>${equipment.code}</title><style>@page{size:${f.w}mm ${f.h}mm;margin:0}html,body{margin:0;padding:0}</style></head><body>${ref.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Imprimir etiqueta · {equipment.code}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Formato</Label>
            <Select value={fmt} onValueChange={(v) => setFmt(v as Fmt)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(FORMATS).map(([k, f]) => <SelectItem key={k} value={k}>{f.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex min-h-48 items-center justify-center rounded-md border bg-muted p-4">
            <div style={{ transform: "scale(2)", transformOrigin: "center" }}>
              <div ref={ref}><LabelView e={equipment} nextDue={nextDue} fmt={fmt} url={url} /></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Vista previa ampliada ×2. Se imprime a tamaño real; en el diálogo de impresión elige escala 100 % y tu impresora de etiquetas.</p>
        </div>
        <DialogFooter><Button onClick={print}><Printer className="mr-1 h-4 w-4" />Imprimir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
