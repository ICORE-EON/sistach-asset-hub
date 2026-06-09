import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy as CopyIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { parseFile, buildCsv, downloadFile, type ParsedRow } from "@/lib/import/parse";
import {
  ENTITY_DEFS,
  loadContext,
  validateRow,
  insertNormalized,
  type TargetEntity,
  type RowValidation,
} from "@/lib/import/entities";

export const Route = createFileRoute("/_authenticated/_app/imports")({
  head: () => ({ meta: [{ title: "Importación" }] }),
  component: ImportsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  running: "secondary",
  validating: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline",
};

function ImportsPage() {
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const canManage = activeMembership?.role === "administrator" || activeMembership?.role === "system_manager";

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["import-batches", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("id, code, target_entity, file_name, status, total_rows, ok_rows, error_rows, duplicate_rows, created_at, finished_at")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Importación masiva</h1>
            <p className="text-sm text-muted-foreground">
              Carga activos y ubicaciones desde CSV o Excel
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Nueva importación
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(ENTITY_DEFS) as TargetEntity[]).map((k) => {
          const def = ENTITY_DEFS[k];
          return (
            <Card key={k}>
              <CardHeader>
                <CardTitle className="text-base">{def.label}</CardTitle>
                <CardDescription className="text-xs">
                  Plantilla con columnas: {def.template.headers.join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadFile(
                      `plantilla-${k}.csv`,
                      buildCsv(def.template.headers, [def.template.sample]),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
          <CardDescription>Últimas importaciones de esta empresa</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">OK</TableHead>
                <TableHead className="text-right">Errores</TableHead>
                <TableHead className="text-right">Duplicados</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Sin importaciones todavía
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell>{ENTITY_DEFS[b.target_entity as TargetEntity]?.label ?? b.target_entity}</TableCell>
                    <TableCell className="text-sm">{b.file_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.total_rows}</TableCell>
                    <TableCell className="text-right text-emerald-600">{b.ok_rows}</TableCell>
                    <TableCell className="text-right text-destructive">{b.error_rows}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.duplicate_rows}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.created_at), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <ImportWizard
          companyId={activeCompanyId!}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["import-batches"] });
            qc.invalidateQueries({ queryKey: ["assets"] });
            qc.invalidateQueries({ queryKey: ["locations"] });
          }}
        />
      )}
    </div>
  );
}

type WizardStep = "select" | "preview" | "importing" | "done";

interface PreviewRow {
  row_number: number;
  raw: ParsedRow;
  validation: RowValidation;
}

function ImportWizard({
  companyId,
  onClose,
  onDone,
}: {
  companyId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [entity, setEntity] = useState<TargetEntity>("locations");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<WizardStep>("select");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [finalCounts, setFinalCounts] = useState<{ ok: number; err: number; dup: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    let ok = 0, err = 0, dup = 0;
    for (const r of preview) {
      if (r.validation.status === "ok") ok++;
      else if (r.validation.status === "duplicate") dup++;
      else err++;
    }
    return { ok, err, dup };
  }, [preview]);

  const validate = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecciona un archivo");
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) throw new Error("El archivo no contiene filas");
      const ctx = await loadContext(companyId);
      const seen = { assetCodes: new Set<string>(), assetSerials: new Set<string>(), locCodes: new Set<string>() };
      const rows: PreviewRow[] = parsed.rows.map((raw, i) => ({
        row_number: i + 2, // +1 header +1 base-1
        raw,
        validation: validateRow(entity, raw, ctx, seen),
      }));
      setPreview(rows);
      setStep("preview");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runImport = useMutation({
    mutationFn: async () => {
      if (!file) return;
      setStep("importing");
      setProgress(0);

      // 1) Crear batch
      const { data: codeData, error: codeErr } = await supabase.rpc("next_code", {
        p_company_id: companyId,
        p_scope: "imports",
        p_prefix: "IMP",
      });
      if (codeErr) throw codeErr;
      const { data: batch, error: bErr } = await supabase
        .from("import_batches")
        .insert({
          company_id: companyId,
          code: codeData as string,
          source_type: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
          target_entity: entity,
          file_name: file.name,
          status: "running",
          total_rows: preview.length,
          started_at: new Date().toISOString(),
          options: { duplicate_policy: "skip" },
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      let ok = 0, err = 0, dup = 0;
      const rowsPayload = preview.map((p) => ({
        batch_id: batch.id,
        row_number: p.row_number,
        raw: p.raw,
        normalized: p.validation.normalized ?? null,
        status: p.validation.status === "ok" ? "pending" : p.validation.status,
        dedupe_key: p.validation.dedupe_key ?? null,
      }));
      // insertar filas en chunks
      for (let i = 0; i < rowsPayload.length; i += 200) {
        const chunk = rowsPayload.slice(i, i + 200);
        const { error: rErr } = await supabase.from("import_rows").insert(chunk as never);
        if (rErr) throw rErr;
      }
      // errores
      const errPayload = preview.flatMap((p) =>
        (p.validation.errors ?? []).map((e) => ({
          batch_id: batch.id,
          error_code: e.code,
          field: e.field ?? null,
          message: e.message,
        })),
      );
      if (errPayload.length) {
        for (let i = 0; i < errPayload.length; i += 200) {
          await supabase.from("import_errors").insert(errPayload.slice(i, i + 200) as never);
        }
      }

      // 2) Recuperar filas pending para insertar (necesitamos su id)
      const { data: pendingRows, error: pErr } = await supabase
        .from("import_rows")
        .select("id, row_number, normalized")
        .eq("batch_id", batch.id)
        .eq("status", "pending")
        .order("row_number");
      if (pErr) throw pErr;

      dup = preview.filter((p) => p.validation.status === "duplicate").length;
      err = preview.filter((p) => p.validation.status === "error").length;

      for (let i = 0; i < (pendingRows ?? []).length; i++) {
        const r = pendingRows![i];
        try {
          const id = await insertNormalized(entity, companyId, r.normalized as Record<string, unknown>);
          await supabase
            .from("import_rows")
            .update({ status: "ok", created_entity_id: id })
            .eq("id", r.id);
          ok++;
        } catch (e) {
          const msg = (e as Error).message || "Error desconocido";
          await supabase
            .from("import_rows")
            .update({ status: "error" })
            .eq("id", r.id);
          await supabase.from("import_errors").insert({
            batch_id: batch.id,
            row_id: r.id,
            error_code: "insert_failed",
            message: msg,
          });
          err++;
        }
        setProgress(Math.round(((i + 1) / pendingRows!.length) * 100));
      }

      await supabase
        .from("import_batches")
        .update({
          status: "done",
          ok_rows: ok,
          error_rows: err,
          duplicate_rows: dup,
          finished_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      setFinalCounts({ ok, err, dup });
      setStep("done");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep("preview");
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva importación</DialogTitle>
          <DialogDescription>
            {step === "select" && "Elige la entidad y sube el archivo (CSV o XLSX)"}
            {step === "preview" && "Revisa los resultados antes de confirmar la importación"}
            {step === "importing" && "Insertando registros…"}
            {step === "done" && "Importación finalizada"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Entidad</Label>
              <Select value={entity} onValueChange={(v) => setEntity(v as TargetEntity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_DEFS) as TargetEntity[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ENTITY_DEFS[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Columnas esperadas: {ENTITY_DEFS[entity].template.headers.join(", ")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Archivo</Label>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center cursor-pointer hover:bg-muted/30"
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm">{file ? file.name : "Haz clic para seleccionar un archivo"}</p>
                <p className="text-xs text-muted-foreground">CSV o XLSX, máx. 5 MB</p>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile icon={<CheckCircle2 className="h-4 w-4" />} label="Válidas" value={stats.ok} tone="ok" />
              <SummaryTile icon={<CopyIcon className="h-4 w-4" />} label="Duplicados" value={stats.dup} tone="muted" />
              <SummaryTile icon={<AlertCircle className="h-4 w-4" />} label="Errores" value={stats.err} tone="err" />
            </div>
            <div className="max-h-[400px] overflow-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead>Datos / Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 200).map((p) => (
                    <TableRow key={p.row_number}>
                      <TableCell className="font-mono text-xs">{p.row_number}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.validation.status === "ok"
                              ? "default"
                              : p.validation.status === "duplicate"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {p.validation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="text-muted-foreground truncate max-w-md">
                          {Object.entries(p.raw)
                            .filter(([, v]) => v)
                            .slice(0, 4)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(" · ")}
                        </div>
                        {p.validation.errors?.map((e, i) => (
                          <div key={i} className="text-destructive">
                            {e.field ? `${e.field}: ` : ""}
                            {e.message}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 200 && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  Mostrando 200 de {preview.length} filas
                </div>
              )}
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Insertando registros…</span>
            </div>
            <Progress value={progress} />
            <p className="text-center text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && finalCounts && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile icon={<CheckCircle2 className="h-4 w-4" />} label="Insertados" value={finalCounts.ok} tone="ok" />
              <SummaryTile icon={<CopyIcon className="h-4 w-4" />} label="Duplicados" value={finalCounts.dup} tone="muted" />
              <SummaryTile icon={<AlertCircle className="h-4 w-4" />} label="Errores" value={finalCounts.err} tone="err" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Puedes revisar el detalle en el historial.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="ghost" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button disabled={!file || validate.isPending} onClick={() => validate.mutate()}>
                {validate.isPending ? "Validando…" : "Validar"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("select")}>
                Volver
              </Button>
              <Button
                disabled={stats.ok === 0 || runImport.isPending}
                onClick={() => runImport.mutate()}
              >
                Importar {stats.ok} fila{stats.ok === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={onDone}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "ok" | "err" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : tone === "err"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${cls}`}>
      {icon}
      <div>
        <div className="text-xs">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
}
