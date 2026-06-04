import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Star, Trash, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  COLUMN_SOURCE_LABELS,
  TEMPLATE_VARIABLES,
  type ColumnSource,
  type TemplateColumn,
} from "@/lib/certificate-templates/types";
import { renderTemplate, resolveCell, type RowSource } from "@/lib/certificate-templates/render";

export const Route = createFileRoute("/_authenticated/_app/certificate-templates/$id")({
  head: () => ({ meta: [{ title: "Editar plantilla" }] }),
  component: TemplateEditor,
});

const SAMPLE_VARS = {
  issuer_name: "Toni Pales",
  issuer_role: "Consultor de seguridad",
  company_name: "Sistach, SA",
  company_cif: "B12345678",
  company_address: "Calle Ejemplo 1, Berga",
  location_name: "Oficina Berga",
  issued_on: "8 de enero de 2026",
  valid_until: "8 de abril de 2026",
  plan_name: "Revisión trimestral extintores",
  cert_code: "CERT-2026-0042",
};

const SAMPLE_ROWS: RowSource[] = [
  {
    asset: {
      code: "EXT-001",
      name: "Extintor CO2 5kg",
      asset_types: { name_i18n: { es: "Extintor CO2" }, code: "ext_co2" },
      locations: { name: "Magatzem" },
    },
    result: "ok",
    notes: "",
  },
  {
    asset: {
      code: "BIE-002",
      name: "BIE 25mm",
      asset_types: { name_i18n: { es: "BIE" }, code: "bie" },
      locations: { name: "Pati" },
    },
    result: "ok",
    notes: "",
  },
];

interface TemplateForm {
  code: string;
  name: string;
  language: string;
  is_default: boolean;
  title: string;
  intro_text: string;
  regulation_text: string;
  footer_text: string;
  columns: TemplateColumn[];
  show_logo: boolean;
  show_signature: boolean;
  show_company_stamp: boolean;
}

function TemplateEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeMembership } = useCompany();
  const role = activeMembership?.role;
  const canManage = role === "administrator" || role === "system_manager";

  const { data: tpl } = useQuery({
    queryKey: ["certificate-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<TemplateForm | null>(null);

  useEffect(() => {
    if (!tpl) return;
    setForm({
      code: tpl.code,
      name: tpl.name,
      language: tpl.language,
      is_default: tpl.is_default,
      title: tpl.title,
      intro_text: tpl.intro_text ?? "",
      regulation_text: tpl.regulation_text ?? "",
      footer_text: tpl.footer_text ?? "",
      columns: (Array.isArray(tpl.columns) ? tpl.columns : []) as unknown as TemplateColumn[],
      show_logo: tpl.show_logo,
      show_signature: tpl.show_signature,
      show_company_stamp: tpl.show_company_stamp,
    });
  }, [tpl]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase
        .from("certificate_templates")
        .update({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          language: form.language,
          is_default: form.is_default,
          title: form.title,
          intro_text: form.intro_text,
          regulation_text: form.regulation_text,
          footer_text: form.footer_text,
          columns: JSON.parse(JSON.stringify(form.columns)),
          show_logo: form.show_logo,
          show_signature: form.show_signature,
          show_company_stamp: form.show_company_stamp,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla guardada");
      qc.invalidateQueries({ queryKey: ["certificate-template", id] });
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("certificate_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
      navigate({ to: "/certificate-templates" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  const update = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) =>
    setForm({ ...form, [k]: v });

  const updateColumn = (idx: number, patch: Partial<TemplateColumn>) => {
    const cols = form.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    update("columns", cols);
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const cols = [...form.columns];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= cols.length) return;
    [cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]];
    update("columns", cols);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/certificate-templates" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
              {form.is_default && (
                <Badge className="gap-1">
                  <Star className="h-3 w-3" />
                  Predeterminada
                </Badge>
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{form.code}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edición</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Vista previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos generales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => update("code", e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={form.language} onValueChange={(v) => update("language", v)} disabled={!canManage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Castellano</SelectItem>
                    <SelectItem value="ca">Català</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_default}
                    onCheckedChange={(v) => update("is_default", v === true)}
                    disabled={!canManage}
                  />
                  Plantilla por defecto de la empresa
                </label>
              </div>
              <div className="flex flex-wrap gap-4 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.show_logo}
                    onCheckedChange={(v) => update("show_logo", v === true)}
                    disabled={!canManage}
                  />
                  Mostrar logo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.show_signature}
                    onCheckedChange={(v) => update("show_signature", v === true)}
                    disabled={!canManage}
                  />
                  Mostrar firma
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.show_company_stamp}
                    onCheckedChange={(v) => update("show_company_stamp", v === true)}
                    disabled={!canManage}
                  />
                  Mostrar sello empresa
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contenido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VariableHints />
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label>Texto introductorio</Label>
                <Textarea
                  rows={6}
                  value={form.intro_text}
                  onChange={(e) => update("intro_text", e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label>Normativa / texto adicional</Label>
                <Textarea
                  rows={3}
                  value={form.regulation_text}
                  onChange={(e) => update("regulation_text", e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <Label>Pie de página (antes de la firma)</Label>
                <Textarea
                  rows={3}
                  value={form.footer_text}
                  onChange={(e) => update("footer_text", e.target.value)}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Columnas de la tabla</CardTitle>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update("columns", [
                      ...form.columns,
                      { key: `col_${form.columns.length + 1}`, label: "Nueva", source: "asset.code", width: 1 },
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir columna
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {form.columns.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin columnas configuradas.</p>
              )}
              {form.columns.map((col, idx) => (
                <div key={idx} className="flex items-end gap-2 rounded-md border p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Etiqueta</Label>
                    <Input
                      value={col.label}
                      onChange={(e) => updateColumn(idx, { label: e.target.value })}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Origen</Label>
                    <Select
                      value={col.source}
                      onValueChange={(v) => updateColumn(idx, { source: v as ColumnSource })}
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COLUMN_SOURCE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Ancho</Label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={col.width ?? 1}
                      onChange={(e) => updateColumn(idx, { width: Number(e.target.value) || 1 })}
                      disabled={!canManage}
                    />
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveColumn(idx, -1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => moveColumn(idx, 1)}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => update("columns", form.columns.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="pt-4">
          <Preview form={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VariableHints() {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-xs">
      <p className="mb-2 font-medium">Variables disponibles (cópialas en el texto):</p>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_VARIABLES.map((v) => (
          <code
            key={v.key}
            className="cursor-pointer rounded bg-background px-1.5 py-0.5"
            title={v.label}
            onClick={() => navigator.clipboard?.writeText(`{{${v.key}}}`)}
          >
            {`{{${v.key}}}`}
          </code>
        ))}
      </div>
    </div>
  );
}

function Preview({ form }: { form: TemplateForm }) {
  const rendered = useMemo(
    () =>
      renderTemplate(
        {
          ...form,
          paper_size: "A4",
          code: form.code,
          name: form.name,
          language: form.language as "es" | "ca" | "en",
        },
        SAMPLE_VARS,
      ),
    [form],
  );

  return (
    <div className="mx-auto max-w-3xl rounded-lg border bg-white p-10 text-slate-900 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold">{rendered.title}</h2>
      <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed">{rendered.intro}</p>
      {rendered.regulation && (
        <p className="mb-4 whitespace-pre-wrap text-xs text-slate-600">{rendered.regulation}</p>
      )}
      {form.columns.length > 0 && (
        <table className="mb-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100">
              {form.columns.map((c) => (
                <th key={c.key} className="border border-slate-300 px-2 py-1.5 text-left font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROWS.map((row, i) => (
              <tr key={i}>
                {form.columns.map((c) => (
                  <td key={c.key} className="border border-slate-300 px-2 py-1.5">
                    {resolveCell(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="whitespace-pre-wrap text-sm">{rendered.footer}</p>
      {form.show_signature && (
        <div className="mt-6">
          <p className="text-sm font-semibold">Firma:</p>
          <div className="mt-1 h-16 w-48 border-b border-slate-400" />
        </div>
      )}
    </div>
  );
}
