/** Checklist of one session item (portable, router-free). Reused by the desktop detail and the mobile run page. */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checklistKeys, checklistService } from "../../services/checklists";
import { sessionKeys, sessionService } from "../../services/sessions";
import { newIdempotencyKey } from "../../services/scan";

export function ItemChecklist({
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
  // One key per completion attempt: double taps / retries never create a second execution.
  const execKey = useRef(newIdempotencyKey());

  const { data: questions = [] } = useQuery({
    queryKey: checklistKeys.itemQuestions(companyId, item.checklist_template_version_id),
    queryFn: () => checklistService.listQuestions(companyId, item.checklist_template_version_id),
  });

  const { data: responses = [] } = useQuery({
    queryKey: checklistKeys.itemResponses(companyId, item.id),
    queryFn: () => checklistService.listResponses(companyId, item.id),
  });

  const responseMap = useMemo(() => {
    const m = new Map<string, typeof responses[number]>();
    responses.forEach((r) => m.set(r.question_id, r));
    return m;
  }, [responses]);

  const saveResponse = useMutation({
    mutationFn: async (args: { question: typeof questions[number]; answer: unknown; isFail: boolean; observations?: string }) => {
      await checklistService.saveResponse(companyId, item.id, item.checklist_template_version_id, {
        question_id: args.question.id,
        answer: args.answer,
        is_fail: args.isFail,
        observations: args.observations ?? null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: checklistKeys.itemResponses(companyId, item.id) }),
    onError: (e: Error) => toast.error(e.message),
  });

  const completeItem = useMutation({
    mutationFn: (intent: "complete" | "na") =>
      sessionService.completeItem(companyId, {
        sessionId, item: { id: item.id, asset_id: item.asset_id }, intent, observations, questions, idempotencyKey: execKey.current,
      }),
    onSuccess: ({ dbResult, createdIncidents, failsWithoutIncident }) => {
      execKey.current = newIdempotencyKey();
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
      qc.invalidateQueries({ queryKey: sessionKeys.items(companyId, sessionId), exact: true });
      qc.invalidateQueries({ queryKey: checklistKeys.itemResponses(companyId, item.id) });
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
            {item.result === "pending" ? "Pendiente" : item.result === "ok" ? "OK" : item.result === "fail" || item.result === "with_incident" ? "Con incidencia" : item.result === "excepted" ? "Excepción" : "N/A"}
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
            <Button variant="outline" onClick={() => completeItem.mutate("na")} disabled={completeItem.isPending}>
              Marcar N/A
            </Button>
            <Button
              variant={anyFail ? "destructive" : "default"}
              onClick={() => completeItem.mutate("complete")}
              disabled={!allRequiredAnswered || completeItem.isPending}
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

