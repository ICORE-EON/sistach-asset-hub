import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  PlayCircle,
  Lock,
  PenLine,
  Eraser,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/attachments-panel";

export const Route = createFileRoute("/_authenticated/_app/maintenance/$id")({
  head: () => ({ meta: [{ title: "Sesión de mantenimiento" }] }),
  component: SessionDetail,
});

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Borrador", variant: "outline" },
  in_progress: { label: "En curso", variant: "secondary" },
  closed: { label: "Cerrada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function SessionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canRun =
    role === "administrator" || role === "system_manager" || role === "manager";

  const { data: session } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_sessions")
        .select("*, maintenance_plans(name, code)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["session-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_items")
        .select("*, assets(id, code, name, manufacturer, model)")
        .eq("session_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const activeItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  const start = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("maintenance_sessions")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sesión iniciada");
      qc.invalidateQueries({ queryKey: ["session", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [closeOpen, setCloseOpen] = useState(false);

  if (!session) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  const status = STATUS_LABELS[session.status] ?? { label: session.status, variant: "outline" as const };
  const isLocked = session.status === "closed" || session.status === "cancelled";
  const editable = canRun && !isLocked;
  const completedCount = items.filter((i) => i.result !== "pending").length;
  const totalCount = items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/maintenance" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {session.maintenance_plans?.name ?? "Sesión ad-hoc"}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {session.code} · {completedCount}/{totalCount} activos completados
              {session.technician_name ? ` · ${session.technician_name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {session.status === "draft" && canRun && (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Iniciar
            </Button>
          )}
          {session.status === "in_progress" && canRun && (
            <Button onClick={() => setCloseOpen(true)} disabled={completedCount < totalCount}>
              <Lock className="mr-2 h-4 w-4" />
              Cerrar y firmar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin activos.</p>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSelectedItemId(it.id)}
                  className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    activeItem?.id === it.id ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <ItemStatusIcon result={it.result} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {it.assets?.name ?? it.assets?.code ?? "—"}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {it.assets?.code}
                    </p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {activeItem ? (
          <ItemChecklist
            key={activeItem.id}
            item={activeItem}
            editable={editable && session.status === "in_progress"}
            companyId={session.company_id}
            sessionId={id}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecciona un activo para ejecutar el checklist.
            </CardContent>
          </Card>
        )}
      </div>

      <AttachmentsPanel entity="maintenance_session" entityId={id} defaultCategory="maintenance_evidence" />



      {closeOpen && (
        <CloseSessionDialog
          sessionId={id}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          onClosed={() => qc.invalidateQueries({ queryKey: ["session", id] })}
        />
      )}
    </div>
  );
}

function ItemStatusIcon({ result }: { result: string }) {
  if (result === "ok") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />;
  if (result === "with_incident" || result === "fail")
    return <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (result === "not_applicable" || result === "na" || result === "skipped")
    return <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
  return <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}

function ItemChecklist({
  item,
  editable,
  companyId,
  sessionId,
}: {
  item: { id: string; asset_id: string; checklist_template_version_id: string; result: string; observations: string | null; assets: { code: string; name: string | null; manufacturer: string | null; model: string | null } | null };
  editable: boolean;
  companyId: string;
  sessionId: string;
}) {
  const qc = useQueryClient();
  const [observations, setObservations] = useState(item.observations ?? "");

  const { data: questions = [] } = useQuery({
    queryKey: ["item-questions", item.checklist_template_version_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_questions")
        .select("*")
        .eq("template_version_id", item.checklist_template_version_id)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["item-responses", item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_responses")
        .select("*")
        .eq("maintenance_item_id", item.id);
      if (error) throw error;
      return data;
    },
  });

  const responseMap = useMemo(() => {
    const m = new Map<string, typeof responses[number]>();
    responses.forEach((r) => m.set(r.question_id, r));
    return m;
  }, [responses]);

  const saveResponse = useMutation({
    mutationFn: async (args: { question: typeof questions[number]; answer: unknown; isFail: boolean; observations?: string }) => {
      const { error } = await supabase.from("checklist_responses").upsert(
        {
          maintenance_item_id: item.id,
          checklist_template_version_id: item.checklist_template_version_id,
          question_id: args.question.id,
          answer: { value: args.answer } as unknown as never,
          is_fail: args.isFail,
          observations: args.observations ?? null,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "maintenance_item_id,question_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["item-responses", item.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const completeItem = useMutation({
    mutationFn: async (intent: "complete" | "na") => {
      let createdIncidents = 0;
      let failsWithoutIncident = 0;
      let dbResult: "ok" | "with_incident" | "not_applicable" = "ok";

      if (intent === "na") {
        dbResult = "not_applicable";
      } else {
        // Releer respuestas frescas desde la BD para evitar race con la caché
        const { data: freshResponses, error: rErr } = await supabase
          .from("checklist_responses")
          .select("id, question_id, is_fail, observations")
          .eq("maintenance_item_id", item.id);
        if (rErr) throw rErr;

        const fails = (freshResponses ?? []).filter((r) => r.is_fail);
        const failedWithIncident = fails.filter((r) => {
          const q = questions.find((qq) => qq.id === r.question_id);
          return q?.creates_incident;
        });
        failsWithoutIncident = fails.length - failedWithIncident.length;

        for (const r of failedWithIncident) {
          const q = questions.find((qq) => qq.id === r.question_id);
          // Evitar duplicar si ya hay incidencia ligada a esta respuesta
          const { data: existing } = await supabase
            .from("incidents")
            .select("id")
            .eq("source_response_id", r.id)
            .maybeSingle();
          if (existing) continue;
          const { data: code } = await supabase.rpc("next_code", {
            p_company_id: companyId,
            p_scope: "incidents",
            p_prefix: "INC",
          });
          const { error: insErr } = await supabase.from("incidents").insert({
            company_id: companyId,
            code: code ?? "",
            title: `Fallo en checklist: ${q?.prompt ?? "pregunta"}`,
            description: r.observations || null,
            severity: "medium",
            status: "open",
            source: "maintenance",
            asset_id: item.asset_id,
            source_maintenance_item_id: item.id,
            source_response_id: r.id,
          });
          if (insErr) throw insErr;
          createdIncidents += 1;
        }

        dbResult = fails.length > 0 ? "with_incident" : "ok";
      }

      const { error } = await supabase
        .from("maintenance_items")
        .update({
          result: dbResult,
          observations: observations || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;

      return { dbResult, createdIncidents, failsWithoutIncident };
    },
    onSuccess: ({ dbResult, createdIncidents, failsWithoutIncident }) => {
      if (dbResult === "not_applicable") {
        toast.success("Activo marcado como N/A");
      } else if (createdIncidents > 0) {
        toast.success(
          `Activo guardado con ${createdIncidents} incidencia${createdIncidents === 1 ? "" : "s"} abierta${createdIncidents === 1 ? "" : "s"}.`,
        );
      } else if (failsWithoutIncident > 0) {
        toast.warning(
          "Activo guardado con fallos. Ninguna pregunta del checklist está configurada para abrir incidencia.",
        );
      } else {
        toast.success("Activo guardado");
      }
      qc.invalidateQueries({ queryKey: ["session-items", sessionId] });
      qc.invalidateQueries({ queryKey: ["item-responses", item.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allRequiredAnswered = questions
    .filter((q) => q.required)
    .every((q) => responseMap.has(q.id));
  const anyFail = responses.some((r) => r.is_fail);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {item.assets?.name ?? item.assets?.code}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {item.assets?.code}
              {item.assets?.manufacturer ? ` · ${item.assets.manufacturer}` : ""}
              {item.assets?.model ? ` ${item.assets.model}` : ""}
            </p>
          </div>
          <Badge variant={item.result === "pending" ? "outline" : item.result === "fail" ? "destructive" : "default"}>
            {item.result === "pending" ? "Pendiente" : item.result === "ok" ? "OK" : item.result === "fail" ? "Falla" : "N/A"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">La plantilla no tiene preguntas.</p>
        ) : (
          questions.map((q, idx) => (
            <QuestionInput
              key={q.id}
              index={idx}
              question={q}
              response={responseMap.get(q.id)}
              disabled={!editable}
              onSave={(answer, isFail, obs) =>
                saveResponse.mutate({ question: q, answer, isFail, observations: obs })
              }
            />
          ))
        )}

        <div className="space-y-2 border-t pt-4">
          <Label>Observaciones del activo</Label>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            disabled={!editable}
            rows={2}
          />
        </div>

        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => completeItem.mutate("na")}>
              Marcar N/A
            </Button>
            <Button
              variant={anyFail ? "destructive" : "default"}
              onClick={() => completeItem.mutate("complete")}
              disabled={!allRequiredAnswered}
            >
              {anyFail ? "Guardar con fallos" : "Marcar OK"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionInput({
  index,
  question,
  response,
  disabled,
  onSave,
}: {
  index: number;
  question: { id: string; prompt: string; help_text: string | null; response_type: string; options: unknown; required: boolean; creates_incident: boolean };
  response?: { answer: unknown; is_fail: boolean; observations: string | null };
  disabled: boolean;
  onSave: (answer: unknown, isFail: boolean, observations?: string) => void;
}) {
  const current = (response?.answer as { value?: unknown } | null | undefined)?.value;
  const [obs, setObs] = useState(response?.observations ?? "");

  const handleBoolean = (value: boolean) => {
    onSave(value, !value, obs);
  };
  const handleChoice = (value: string) => {
    const opts = (question.options as { choices?: string[]; failOn?: string[] } | null) ?? {};
    const failOn = opts.failOn ?? [];
    onSave(value, failOn.includes(value), obs);
  };

  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {index + 1}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">
            {question.prompt}
            {question.required && <span className="text-destructive"> *</span>}
          </p>
          {question.help_text && (
            <p className="text-xs text-muted-foreground">{question.help_text}</p>
          )}
        </div>
        {response?.is_fail && (
          <div className="flex flex-col items-end gap-1">
            <Badge variant="destructive" className="text-xs">Falla</Badge>
            {!question.creates_incident && (
              <span className="text-[10px] text-muted-foreground">
                No abre incidencia automática
              </span>
            )}
          </div>
        )}
      </div>

      <div className="pl-9">
        {question.response_type === "boolean" && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={current === true ? "default" : "outline"}
              onClick={() => handleBoolean(true)}
              disabled={disabled}
            >
              Sí
            </Button>
            <Button
              type="button"
              size="sm"
              variant={current === false ? "destructive" : "outline"}
              onClick={() => handleBoolean(false)}
              disabled={disabled}
            >
              No
            </Button>
          </div>
        )}
        {question.response_type === "text" && (
          <Input
            defaultValue={typeof current === "string" ? current : ""}
            disabled={disabled}
            onBlur={(e) => onSave(e.target.value, false, obs)}
            placeholder="Respuesta"
          />
        )}
        {question.response_type === "number" && (
          <Input
            type="number"
            defaultValue={typeof current === "number" ? current : ""}
            disabled={disabled}
            onBlur={(e) => onSave(Number(e.target.value), false, obs)}
          />
        )}
        {question.response_type === "choice" && (
          <Select
            value={typeof current === "string" ? current : ""}
            onValueChange={handleChoice}
            disabled={disabled}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {((question.options as { choices?: string[] } | null)?.choices ?? []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(response?.is_fail || obs) && (
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => onSave(current, response?.is_fail ?? false, obs)}
            disabled={disabled}
            rows={2}
            placeholder="Observaciones / motivo del fallo"
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}

function CloseSessionDialog({
  sessionId,
  open,
  onOpenChange,
  onClosed,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClosed: () => void;
}) {
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  const close = useMutation({
    mutationFn: async () => {
      if (!signerName.trim()) throw new Error("Indica el nombre del firmante");
      if (!hasInk.current) throw new Error("Firma para continuar");
      const c = canvasRef.current!;
      const signature = c.toDataURL("image/png");

      // 1. Load session + plan + items to build the certificate
      const { data: session, error: sErr } = await supabase
        .from("maintenance_sessions")
        .select("*, maintenance_plans(name, interval_months)")
        .eq("id", sessionId)
        .single();
      if (sErr) throw sErr;

      const { data: items, error: iErr } = await supabase
        .from("maintenance_items")
        .select("id, asset_id, result, observations")
        .eq("session_id", sessionId);
      if (iErr) throw iErr;

      // 2. Close the session
      const { error } = await supabase
        .from("maintenance_sessions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          signer_name: signerName.trim(),
          signer_role: signerRole.trim() || null,
          signature_image_url: signature,
        })
        .eq("id", sessionId);
      if (error) throw error;

      // 3. Generate certificate
      const { data: code, error: codeErr } = await supabase.rpc("next_code", {
        p_company_id: session.company_id,
        p_scope: "certificate",
        p_prefix: "CERT",
      });
      if (codeErr) throw codeErr;

      const today = new Date();
      const intervalMonths = session.maintenance_plans?.interval_months ?? null;
      const validUntil = intervalMonths
        ? new Date(today.getFullYear(), today.getMonth() + intervalMonths, today.getDate())
            .toISOString()
            .slice(0, 10)
        : null;

      const okCount = items.filter((i) => i.result === "ok").length;
      const failCount = items.filter((i) => i.result === "with_incident" || i.result === "fail").length;
      const summary = `${okCount} activo(s) OK${failCount > 0 ? `, ${failCount} con incidencias` : ""}.`;

      const { data: cert, error: certErr } = await supabase
        .from("certificates")
        .insert({
          company_id: session.company_id,
          code,
          title: `Certificado de mantenimiento — ${session.maintenance_plans?.name ?? session.code}`,
          issued_on: today.toISOString().slice(0, 10),
          valid_until: validUntil,
          issuer_name: signerName.trim(),
          issuer_role: signerRole.trim() || null,
          signature_image_url: signature,
          notes: summary,
          status: "issued",
        })
        .select()
        .single();
      if (certErr) throw certErr;

      if (items.length > 0) {
        const certItems = items.map((it) => ({
          certificate_id: cert.id,
          asset_id: it.asset_id,
          maintenance_session_id: sessionId,
          maintenance_item_id: it.id,
          result: it.result === "pending" ? "ok" : it.result,
          notes: it.observations ?? null,
        }));
        const { error: ciErr } = await supabase.from("certificate_items").insert(certItems);
        if (ciErr) throw ciErr;
      }

      return cert;
    },
    onSuccess: (cert) => {
      toast.success(`Sesión cerrada. Certificado ${cert.code} emitido.`);
      onClosed();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar y firmar sesión</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Firmante *</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={signerRole} onChange={(e) => setSignerRole(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Firma
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <Eraser className="mr-1.5 h-3.5 w-3.5" />
                Limpiar
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={460}
              height={160}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              className="w-full touch-none rounded-md border bg-background"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => close.mutate()} disabled={close.isPending}>
            {close.isPending ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
