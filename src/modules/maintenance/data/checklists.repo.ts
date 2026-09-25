/**
 * Checklist templates / versions / questions / scope / responses repository.
 * Only checklist_templates carries company_id: every child row is reached through a guard that
 * proves its parent template (or maintenance session) belongs to the orgId passed in.
 * Arrays (asset_type_ids, location_ids) are kept as-is until the phase-5 normalization.
 */
import type { Json } from "@/integrations/supabase/types";
import type { StandaloneClient } from "../adapters/standalone/client";

export const TEMPLATE_LIST_FIELDS =
  "id, code, name, active, current_version, asset_type_id, asset_family_id, asset_type_ids, location_ids, include_sublocations";

export type TemplateScopeInput = {
  asset_family_id: string | null; asset_type_ids: string[]; location_ids: string[]; include_sublocations: boolean;
};
export type NewTemplate = TemplateScopeInput & { code: string; name: string; description: string | null };
export type NewQuestion = {
  position: number; prompt: string; help_text: string | null; response_type: string;
  required: boolean; creates_incident: boolean; options: Json | null;
};
export type ResponseInput = { question_id: string; answer: unknown; is_fail: boolean; observations: string | null };

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
/** Legacy single-type column mirrors the array when exactly one type is chosen. */
const legacyType = (ids: string[]) => (ids.length === 1 ? ids[0] : null);

export function createChecklistsRepo(c: StandaloneClient) {
  const assertTemplate = async (orgId: string, templateId: string) => {
    const row = ok(await c.from("checklist_templates").select("id").eq("id", templateId).eq("company_id", orgId).maybeSingle());
    if (!row) throw new Error("Plantilla no encontrada en la organización activa");
  };
  const assertVersion = async (orgId: string, versionId: string) => {
    const v = ok(await c.from("checklist_template_versions").select("id, template_id").eq("id", versionId).maybeSingle());
    if (!v) throw new Error("Versión no encontrada en la organización activa");
    await assertTemplate(orgId, v.template_id);
    return v;
  };
  const assertItem = async (orgId: string, itemId: string) => {
    const it = ok(await c.from("maintenance_items").select("id, session_id").eq("id", itemId).maybeSingle());
    if (!it) throw new Error("Equipo de sesión no encontrado en la organización activa");
    const s = ok(await c.from("maintenance_sessions").select("id").eq("id", it.session_id).eq("company_id", orgId).maybeSingle());
    if (!s) throw new Error("Equipo de sesión no encontrado en la organización activa");
  };

  return {
    // ---- templates ----
    async listTemplates(orgId: string) {
      return ok(await c.from("checklist_templates").select(TEMPLATE_LIST_FIELDS)
        .eq("company_id", orgId).is("deleted_at", null).order("code")) ?? [];
    },
    async getTemplate(orgId: string, id: string) {
      return ok(await c.from("checklist_templates").select("*, asset_types(code, name_i18n)")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
    },
    async getTemplateScope(orgId: string, id: string) {
      return ok(await c.from("checklist_templates")
        .select("asset_family_id, asset_type_ids, location_ids, include_sublocations")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
    },
    async createTemplate(orgId: string, v: NewTemplate) {
      const tpl = ok(await c.from("checklist_templates").insert({
        company_id: orgId, code: v.code, name: v.name, asset_family_id: v.asset_family_id,
        asset_type_ids: v.asset_type_ids, asset_type_id: legacyType(v.asset_type_ids),
        location_ids: v.location_ids, include_sublocations: v.include_sublocations,
        description: v.description, current_version: 0,
      }).select("id").single())!;
      ok(await c.from("checklist_template_versions").insert({ template_id: tpl.id, version: 1, is_published: false }));
      return tpl.id as string;
    },
    async updateTemplateScope(orgId: string, id: string, v: TemplateScopeInput) {
      ok(await c.from("checklist_templates").update({
        asset_family_id: v.asset_family_id, asset_type_ids: v.asset_type_ids,
        asset_type_id: legacyType(v.asset_type_ids), location_ids: v.location_ids,
        include_sublocations: v.include_sublocations,
      }).eq("id", id).eq("company_id", orgId));
    },
    async listPublishedTemplates(orgId: string) {
      return ok(await c.from("checklist_templates")
        .select("id, code, name, asset_type_id, asset_family_id, asset_type_ids, location_ids, include_sublocations")
        .eq("company_id", orgId).is("deleted_at", null).eq("active", true)
        .gt("current_version", 0).order("name")) ?? [];
    },

    // ---- versions ----
    async listVersions(orgId: string, templateId: string) {
      await assertTemplate(orgId, templateId);
      return ok(await c.from("checklist_template_versions").select("*")
        .eq("template_id", templateId).order("version", { ascending: false })) ?? [];
    },
    /** Latest published version per template; ids outside the org are ignored. */
    async latestPublishedVersions(orgId: string, templateIds: string[]) {
      const out = new Map<string, string>();
      if (!templateIds.length) return out;
      const own = ok(await c.from("checklist_templates").select("id").eq("company_id", orgId).in("id", templateIds)) ?? [];
      const ids = own.map((r) => r.id);
      if (!ids.length) return out;
      const rows = ok(await c.from("checklist_template_versions").select("id, template_id, version")
        .in("template_id", ids).eq("is_published", true).order("version", { ascending: false })) ?? [];
      for (const r of rows) if (!out.has(r.template_id)) out.set(r.template_id, r.id);
      return out;
    },
    async publishVersion(orgId: string, templateId: string, versionId: string, version: number) {
      const v = await assertVersion(orgId, versionId);
      if (v.template_id !== templateId) throw new Error("La versión no pertenece a la plantilla");
      ok(await c.from("checklist_template_versions")
        .update({ is_published: true, published_at: new Date().toISOString() }).eq("id", versionId));
      // Same non-blocking behaviour as before for the counter update.
      await c.from("checklist_templates").update({ current_version: version }).eq("id", templateId).eq("company_id", orgId);
    },
    /** New draft version, cloning the questions of `cloneFromVersionId` when given. */
    async createVersion(orgId: string, templateId: string, next: number, cloneFromVersionId: string | null) {
      await assertTemplate(orgId, templateId);
      const created = ok(await c.from("checklist_template_versions")
        .insert({ template_id: templateId, version: next, is_published: false }).select().single())!;
      if (cloneFromVersionId) {
        await assertVersion(orgId, cloneFromVersionId);
        const { data: prev } = await c.from("checklist_questions").select("*")
          .eq("template_version_id", cloneFromVersionId).order("position");
        if (prev?.length) {
          await c.from("checklist_questions").insert(prev.map((q) => ({
            template_version_id: created.id, position: q.position, prompt: q.prompt, help_text: q.help_text,
            response_type: q.response_type, options: q.options, required: q.required,
            creates_incident: q.creates_incident, fails_on: q.fails_on, metadata: q.metadata,
          })));
        }
      }
      return created.id as string;
    },

    // ---- questions ----
    async listQuestions(orgId: string, versionId: string) {
      await assertVersion(orgId, versionId);
      return ok(await c.from("checklist_questions").select("*")
        .eq("template_version_id", versionId).order("position")) ?? [];
    },
    async addQuestion(orgId: string, versionId: string, q: NewQuestion) {
      await assertVersion(orgId, versionId);
      ok(await c.from("checklist_questions").insert({ template_version_id: versionId, ...q }));
    },
    async deleteQuestion(orgId: string, versionId: string, questionId: string) {
      await assertVersion(orgId, versionId);
      ok(await c.from("checklist_questions").delete().eq("id", questionId).eq("template_version_id", versionId));
    },

    // ---- responses (session items) ----
    async listResponses(orgId: string, itemId: string) {
      await assertItem(orgId, itemId);
      return ok(await c.from("checklist_responses").select("*").eq("maintenance_item_id", itemId)) ?? [];
    },
    async saveResponse(orgId: string, itemId: string, versionId: string, r: ResponseInput) {
      await assertItem(orgId, itemId);
      ok(await c.from("checklist_responses").upsert({
        maintenance_item_id: itemId, checklist_template_version_id: versionId, question_id: r.question_id,
        answer: { value: r.answer } as unknown as Json, is_fail: r.is_fail, observations: r.observations,
        answered_at: new Date().toISOString(),
      }, { onConflict: "maintenance_item_id,question_id" }));
    },
  };
}

export type ChecklistsRepo = ReturnType<typeof createChecklistsRepo>;
