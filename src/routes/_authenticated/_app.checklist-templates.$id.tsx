import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, CheckCircle2, FileText, GitBranch } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/checklist-templates/$id")({
  head: () => ({ meta: [{ title: "Editor de plantilla" }] }),
  component: TemplateEditor,
});

const RESPONSE_TYPES = [
  { value: "boolean", label: "Sí / No" },
  { value: "text", label: "Texto libre" },
  { value: "number", label: "Numérico" },
  { value: "choice", label: "Opción múltiple" },
];

function TemplateEditor() {
  const { id } = Route.useParams();
  const { activeMembership } = useCompany();
  const qc = useQueryClient();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: template } = useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*, asset_types(code, name_i18n)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["template-versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_versions")
        .select("*")
        .eq("template_id", id)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const activeVersion = useMemo(() => {
    if (selectedVersionId) return versions.find((v) => v.id === selectedVersionId) ?? null;
    return versions.find((v) => !v.is_published) ?? versions[0] ?? null;
  }, [versions, selectedVersionId]);

  const { data: questions = [] } = useQuery({
    queryKey: ["questions", activeVersion?.id],
    enabled: !!activeVersion?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_questions")
        .select("*")
        .eq("template_version_id", activeVersion!.id)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const publishVersion = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      const { error } = await supabase
        .from("checklist_template_versions")
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .eq("id", activeVersion.id);
      if (error) throw error;
      await supabase
        .from("checklist_templates")
        .update({ current_version: activeVersion.version })
        .eq("id", id);
    },
    onSuccess: () => {
      toast.success("Versión publicada");
      qc.invalidateQueries({ queryKey: ["template-versions", id] });
      qc.invalidateQueries({ queryKey: ["template", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newVersion = useMutation({
    mutationFn: async () => {
      const next = Math.max(0, ...versions.map((v) => v.version)) + 1;
      const { data, error } = await supabase
        .from("checklist_template_versions")
        .insert({ template_id: id, version: next, is_published: false })
        .select()
        .single();
      if (error) throw error;
      // Clonar preguntas de la última versión publicada
      const lastPublished = versions.find((v) => v.is_published);
      if (lastPublished) {
        const { data: prev } = await supabase
          .from("checklist_questions")
          .select("*")
          .eq("template_version_id", lastPublished.id)
          .order("position");
        if (prev?.length) {
          const clones = prev.map((q) => ({
            template_version_id: data.id,
            position: q.position,
            prompt: q.prompt,
            help_text: q.help_text,
            response_type: q.response_type,
            options: q.options,
            required: q.required,
            creates_incident: q.creates_incident,
            fails_on: q.fails_on,
            metadata: q.metadata,
          }));
          await supabase.from("checklist_questions").insert(clones);
        }
      }
      return data.id;
    },
    onSuccess: (newId) => {
      toast.success("Nueva versión creada");
      setSelectedVersionId(newId);
      qc.invalidateQueries({ queryKey: ["template-versions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!template) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/checklist-templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{template.code}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => newVersion.mutate()} disabled={newVersion.isPending}>
            <GitBranch className="mr-2 h-4 w-4" />
            Nueva versión
          </Button>
        )}
      </div>

      <ScopeCard templateId={id} canManage={!!canManage} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card>

          <CardHeader>
            <CardTitle className="text-sm">Versiones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  activeVersion?.id === v.id ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">v{v.version}</span>
                {v.is_published ? (
                  <Badge variant="default" className="text-xs">
                    Publicada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Borrador
                  </Badge>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Preguntas — v{activeVersion?.version ?? "—"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeVersion?.is_published
                  ? "Esta versión está publicada y no se puede modificar"
                  : "Borrador editable hasta la publicación"}
              </p>
            </div>
            {canManage && activeVersion && !activeVersion.is_published && (
              <div className="flex gap-2">
                <AddQuestionDialog
                  versionId={activeVersion.id}
                  nextPosition={(questions.at(-1)?.position ?? 0) + 1}
                  onCreated={() => qc.invalidateQueries({ queryKey: ["questions", activeVersion.id] })}
                />
                <Button
                  onClick={() => publishVersion.mutate()}
                  disabled={publishVersion.isPending || questions.length === 0}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Publicar
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-6 w-6" />
                Aún no hay preguntas en esta versión.
              </div>
            ) : (
              questions.map((q, idx) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  index={idx}
                  editable={!!canManage && !activeVersion?.is_published}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ["questions", activeVersion?.id] })}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  index,
  editable,
  onDeleted,
}: {
  question: { id: string; prompt: string; response_type: string; required: boolean; creates_incident: boolean; help_text: string | null };
  index: number;
  editable: boolean;
  onDeleted: () => void;
}) {
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklist_questions").delete().eq("id", question.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pregunta eliminada");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-start gap-3 rounded-md border bg-card p-3">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {index + 1}
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{question.prompt}</p>
        {question.help_text && (
          <p className="text-xs text-muted-foreground">{question.help_text}</p>
        )}
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            {RESPONSE_TYPES.find((r) => r.value === question.response_type)?.label ?? question.response_type}
          </Badge>
          {question.required && (
            <Badge variant="outline" className="text-xs">
              Obligatoria
            </Badge>
          )}
          {question.creates_incident && (
            <Badge variant="destructive" className="text-xs">
              Genera incidencia si falla
            </Badge>
          )}
        </div>
      </div>
      {editable && (
        <Button variant="ghost" size="icon" onClick={() => remove.mutate()}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function AddQuestionDialog({
  versionId,
  nextPosition,
  onCreated,
}: {
  versionId: string;
  nextPosition: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [helpText, setHelpText] = useState("");
  const [responseType, setResponseType] = useState("boolean");
  const [required, setRequired] = useState(true);
  const [createsIncident, setCreatesIncident] = useState(true);
  const [choices, setChoices] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) throw new Error("Escribe la pregunta");
      const options =
        responseType === "choice"
          ? { choices: choices.split(",").map((c) => c.trim()).filter(Boolean) }
          : null;
      const { error } = await supabase.from("checklist_questions").insert({
        template_version_id: versionId,
        position: nextPosition,
        prompt: prompt.trim(),
        help_text: helpText || null,
        response_type: responseType,
        required,
        creates_incident: createsIncident,
        options,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pregunta añadida");
      setOpen(false);
      setPrompt("");
      setHelpText("");
      setChoices("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Añadir pregunta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva pregunta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pregunta *</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Texto de ayuda</Label>
            <Input value={helpText} onChange={(e) => setHelpText(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de respuesta</Label>
            <Select value={responseType} onValueChange={setResponseType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {responseType === "choice" && (
            <div className="space-y-2">
              <Label>Opciones (separadas por coma)</Label>
              <Input value={choices} onChange={(e) => setChoices(e.target.value)} placeholder="OK, Sustituir, Revisar" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="required" checked={required} onCheckedChange={(c) => setRequired(!!c)} />
            <Label htmlFor="required" className="font-normal">Obligatoria</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="incident"
              checked={createsIncident}
              onCheckedChange={(c) => setCreatesIncident(!!c)}
            />
            <Label htmlFor="incident" className="font-normal">
              Genera incidencia automáticamente si la respuesta es negativa
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Añadiendo…" : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
