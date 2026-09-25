import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, CheckCircle2, FileText, GitBranch } from "lucide-react";
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
import { i18nName } from "@/lib/i18n-name";
import { describeTemplateScope } from "@/modules/maintenance/domain/checklist-scope";
import { assetKeys, assetService } from "@/modules/maintenance/services/assets";
import { checklistKeys, checklistService } from "@/modules/maintenance/services/checklists";

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
  const { activeCompanyId, activeMembership } = useCompany();
  const qc = useQueryClient();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: template } = useQuery({
    queryKey: checklistKeys.detail(activeCompanyId, id),
    enabled: !!activeCompanyId,
    queryFn: () => checklistService.getTemplate(activeCompanyId, id),
  });

  const { data: versions = [] } = useQuery({
    queryKey: checklistKeys.versions(activeCompanyId, id),
    enabled: !!activeCompanyId,
    queryFn: () => checklistService.listVersions(activeCompanyId, id),
  });

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const activeVersion = useMemo(() => {
    if (selectedVersionId) return versions.find((v) => v.id === selectedVersionId) ?? null;
    return versions.find((v) => !v.is_published) ?? versions[0] ?? null;
  }, [versions, selectedVersionId]);

  const { data: questions = [] } = useQuery({
    queryKey: checklistKeys.questions(activeCompanyId, activeVersion?.id),
    enabled: !!activeCompanyId && !!activeVersion?.id,
    queryFn: () => checklistService.listQuestions(activeCompanyId, activeVersion!.id),
  });

  const publishVersion = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      await checklistService.publishVersion(activeCompanyId, id, activeVersion.id, activeVersion.version);
    },
    onSuccess: () => {
      toast.success("Versión publicada");
      qc.invalidateQueries({ queryKey: checklistKeys.versions(activeCompanyId, id) });
      qc.invalidateQueries({ queryKey: checklistKeys.detail(activeCompanyId, id) });
      qc.invalidateQueries({ queryKey: checklistKeys.list(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newVersion = useMutation({
    mutationFn: async () => {
      const next = Math.max(0, ...versions.map((v) => v.version)) + 1;
      // Clonar preguntas de la última versión publicada
      const lastPublished = versions.find((v) => v.is_published);
      return checklistService.createVersion(activeCompanyId, id, next, lastPublished?.id ?? null);
    },
    onSuccess: (newId) => {
      toast.success("Nueva versión creada");
      setSelectedVersionId(newId);
      qc.invalidateQueries({ queryKey: checklistKeys.versions(activeCompanyId, id) });
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
                  onCreated={() => qc.invalidateQueries({ queryKey: checklistKeys.questions(activeCompanyId, activeVersion.id) })}
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
                  versionId={activeVersion!.id}
                  editable={!!canManage && !activeVersion?.is_published}
                  onDeleted={() => qc.invalidateQueries({ queryKey: checklistKeys.questions(activeCompanyId, activeVersion?.id) })}
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
  versionId,
  editable,
  onDeleted,
}: {
  question: { id: string; prompt: string; response_type: string; required: boolean; creates_incident: boolean; help_text: string | null };
  index: number;
  versionId: string;
  editable: boolean;
  onDeleted: () => void;
}) {
  const { activeCompanyId } = useCompany();
  const remove = useMutation({
    mutationFn: () => checklistService.deleteQuestion(activeCompanyId, versionId, question.id),
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
  const { activeCompanyId } = useCompany();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [helpText, setHelpText] = useState("");
  const [responseType, setResponseType] = useState("boolean");
  const [required, setRequired] = useState(true);
  const [createsIncident, setCreatesIncident] = useState(true);
  const [choices, setChoices] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const options =
        responseType === "choice"
          ? { choices: choices.split(",").map((c) => c.trim()).filter(Boolean) }
          : null;
      await checklistService.addQuestion(activeCompanyId, versionId, {
        position: nextPosition,
        prompt,
        help_text: helpText || null,
        response_type: responseType,
        required,
        creates_incident: createsIncident,
        options,
      });
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

function ScopeCard({ templateId, canManage }: { templateId: string; canManage: boolean }) {
  const { activeCompanyId } = useCompany();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: scope } = useQuery({
    queryKey: checklistKeys.scope(activeCompanyId, templateId),
    enabled: !!activeCompanyId,
    queryFn: () => checklistService.getTemplateScope(activeCompanyId, templateId),
  });

  const { data: families = [] } = useQuery({
    queryKey: assetKeys.families(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listFamilies(activeCompanyId),
  });
  const { data: types = [] } = useQuery({
    queryKey: assetKeys.typesForFamilies(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listTypes(activeCompanyId),
  });
  const { data: locations = [] } = useQuery({
    queryKey: assetKeys.scopeSites(activeCompanyId),
    enabled: !!activeCompanyId,
    queryFn: () => assetService.listScopeSites(activeCompanyId),
  });

  const [familyId, setFamilyId] = useState<string>("");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [includeSub, setIncludeSub] = useState(true);
  const [loaded, setLoaded] = useState(false);

  if (scope && !loaded) {
    setFamilyId(scope.asset_family_id ?? "");
    setTypeIds(scope.asset_type_ids ?? []);
    setLocationIds(scope.location_ids ?? []);
    setIncludeSub(scope.include_sublocations !== false);
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () =>
      checklistService.updateTemplateScope(activeCompanyId, templateId, {
        asset_family_id: familyId || null,
        asset_type_ids: typeIds,
        location_ids: locationIds,
        include_sublocations: includeSub,
      }),
    onSuccess: () => {
      toast.success("Ámbito actualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: checklistKeys.scope(activeCompanyId, templateId) });
      qc.invalidateQueries({ queryKey: checklistKeys.list(activeCompanyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const familyTypes = types.filter((t) => t.family_id === familyId);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const description = describeTemplateScope(
    {
      id: templateId,
      code: "",
      name: "",
      asset_type_id: null,
      asset_family_id: familyId || null,
      asset_type_ids: typeIds,
      location_ids: locationIds,
      include_sublocations: includeSub,
    },
    {
      familyName: familyId
        ? i18nName(
            families.find((f) => f.id === familyId)?.name_i18n,
            families.find((f) => f.id === familyId)?.code ?? "—",
          )
        : null,
      typeNames: (ids) =>
        ids.map((id) => {
          const t = types.find((x) => x.id === id);
          return t ? i18nName(t.name_i18n, t.code) : "—";
        }),
      locationNames: (ids) => ids.map((id) => locations.find((l) => l.id === id)?.name ?? "—"),
    },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ámbito de aplicación</CardTitle>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancelar" : "Editar"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Familia</p>
              <p>{description.family}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tipos</p>
              <p>{description.types}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Centros</p>
              <p>{description.locations}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Familia de activos</Label>
              <Select
                value={familyId}
                onValueChange={(v) => {
                  setFamilyId(v);
                  setTypeIds([]);
                }}
              >
                <SelectTrigger className="w-full sm:w-[320px]">
                  <SelectValue placeholder="Selecciona familia" />
                </SelectTrigger>
                <SelectContent>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {i18nName(f.name_i18n, f.code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs uppercase text-muted-foreground">
                Tipos de activo (sin marcar = todos los de la familia)
              </Label>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {familyTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={typeIds.includes(t.id)}
                      onCheckedChange={() => toggle(typeIds, setTypeIds, t.id)}
                    />
                    {i18nName(t.name_i18n, t.code)}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs uppercase text-muted-foreground">
                Centros (sin marcar = todos)
              </Label>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={locationIds.includes(l.id)}
                      onCheckedChange={() => toggle(locationIds, setLocationIds, l.id)}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeSub} onCheckedChange={(c) => setIncludeSub(!!c)} />
                Incluir sububicaciones
              </label>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar ámbito"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
