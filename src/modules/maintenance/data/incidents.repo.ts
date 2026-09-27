/**
 * Incidents repository: the only place that reads/writes incidents, their status history, the
 * assignable members list and the asset tab. Every call is scoped to orgId; children (history) and
 * references (asset, assignee) are verified against the active org before reading or writing.
 */
import type { StandaloneClient } from "../adapters/standalone/client";
import type { Json } from "@/integrations/supabase/types";
import {
  assertIncidentTransition, assertSeverity, isIncidentClosed, transitionPatch, type IncidentOriginSnapshot,
} from "../domain/incident-rules";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const NOT_FOUND = "Incidencia no encontrada";
const CROSS = "El recurso no pertenece a la organización activa";

export type FailedResponse = { id: string; observations: string | null; prompt: string | undefined; question_id?: string | null; version_id?: string | null };
export type FailureContext = {
  session: { id: string; code: string | null };
  item: { id: string; asset_id: string };
  asset: { code: string | null; name: string | null };
};

/** In-process single flight per response: a double click never runs two creations concurrently. */
const inflight = new Map<string, Promise<boolean>>();

export function createIncidentsRepo(c: StandaloneClient) {
  const getOwn = async (orgId: string, id: string) => {
    const i = ok(await c.from("incidents").select("id, status, company_id").eq("id", id).eq("company_id", orgId).maybeSingle());
    if (!i) throw new Error(NOT_FOUND);
    return i;
  };
  const assertAsset = async (orgId: string, assetId: string) => {
    const a = ok(await c.from("assets").select("id").eq("id", assetId).eq("company_id", orgId).maybeSingle());
    if (!a) throw new Error(CROSS);
  };
  const assertMember = async (orgId: string, userId: string) => {
    const m = ok(await c.from("company_members").select("user_id").eq("company_id", orgId).eq("user_id", userId).eq("active", true).maybeSingle());
    if (!m) throw new Error(CROSS);
  };

  const createOne = async (orgId: string, ctx: FailureContext, r: FailedResponse, now: string) => {
    const existing = ok(await c.from("incidents").select("id").eq("source_response_id", r.id).limit(1).maybeSingle());
    if (existing) return false;
    const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "incidents", p_prefix: "INC" }));
    const origin: IncidentOriginSnapshot = {
      schema: 1, kind: "checklist_failure", captured_at: now,
      session: { id: ctx.session.id, code: ctx.session.code },
      item: { id: ctx.item.id },
      asset: { id: ctx.item.asset_id, code: ctx.asset.code, name: ctx.asset.name },
      question: { id: r.question_id ?? null, prompt: r.prompt ?? null, version_id: r.version_id ?? null },
    };
    ok(await c.from("incidents").insert({
      company_id: orgId, code: (code as string) ?? "", title: `Fallo en checklist: ${r.prompt ?? "pregunta"}`,
      description: r.observations || null, severity: "medium", status: "open", source: "maintenance",
      asset_id: ctx.item.asset_id, source_maintenance_item_id: ctx.item.id, source_response_id: r.id,
      metadata: { origin } as unknown as Json,
    }));
    return true;
  };

  return {
    async listIncidents(orgId: string, severity: string) {
      let q = c.from("incidents").select("*, assets(code, name)").eq("company_id", orgId)
        .order("created_at", { ascending: false }).limit(500);
      if (severity !== "all") q = q.eq("severity", severity);
      return ok(await q);
    },

    async getIncident(orgId: string, id: string) {
      const i = ok(await c.from("incidents").select("*, assets(id, code, name), locations(id, name)")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
      if (!i) throw new Error(NOT_FOUND);
      return i;
    },

    async listHistory(orgId: string, id: string) {
      await getOwn(orgId, id);
      return ok(await c.from("incident_status_history").select("*").eq("incident_id", id).order("changed_at", { ascending: false }));
    },

    async listMembers(orgId: string) {
      return ok(await c.from("company_members").select("user_id, role").eq("company_id", orgId).eq("active", true));
    },

    async listAssetOptions(orgId: string) {
      return ok(await c.from("assets").select("id, code, name").eq("company_id", orgId).is("deleted_at", null).order("code").limit(500));
    },

    async listAssetIncidents(orgId: string, assetId: string) {
      await assertAsset(orgId, assetId);
      return ok(await c.from("incidents").select("id, code, title, severity, status, created_at")
        .eq("company_id", orgId).eq("asset_id", assetId).order("created_at", { ascending: false }));
    },

    async createManual(orgId: string, v: { title: string; description: string | null; severity: string; assetId: string | null }) {
      assertSeverity(v.severity);
      if (v.assetId) await assertAsset(orgId, v.assetId);
      const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "incidents", p_prefix: "INC" }));
      return ok(await c.from("incidents").insert({
        company_id: orgId, code: code as string, title: v.title, description: v.description, severity: v.severity,
        status: "open", source: "manual", asset_id: v.assetId,
      }).select().single());
    },

    async update(orgId: string, id: string, v: { title: string; description: string | null; severity: string; assignedTo: string | null; dueDate: string | null }) {
      const i = await getOwn(orgId, id);
      if (isIncidentClosed(i.status)) throw new Error("La incidencia está cerrada; reábrela para modificarla");
      assertSeverity(v.severity);
      if (v.assignedTo) await assertMember(orgId, v.assignedTo);
      ok(await c.from("incidents").update({
        title: v.title, description: v.description, severity: v.severity, assigned_to: v.assignedTo, due_date: v.dueDate,
      }).eq("id", id).eq("company_id", orgId));
    },

    /**
     * Transition from the status the screen showed (`from`). Re-reads the fresh status and updates
     * with an optimistic lock, so a stale screen or double click never applies an invalid transition.
     */
    async changeStatus(orgId: string, id: string, v: { from: string; to: string; note: string | null; userId: string | null; resolutionNotes?: string }) {
      const i = await getOwn(orgId, id);
      if (i.status !== v.from) throw new Error("La incidencia ha cambiado de estado; recarga la página");
      assertIncidentTransition(i.status, v.to);
      const hit = ok(await c.from("incidents").update(transitionPatch(v.to, new Date().toISOString(), v.resolutionNotes))
        .eq("id", id).eq("company_id", orgId).eq("status", i.status).select("id"));
      if (!hit || hit.length === 0) throw new Error("La incidencia ha cambiado de estado; recarga la página");
      ok(await c.from("incident_status_history").insert({
        incident_id: id, from_status: i.status, to_status: v.to, note: v.note || null, changed_by: v.userId,
      }));
    },

    async remove(orgId: string, id: string) {
      await getOwn(orgId, id);
      ok(await c.from("incidents").delete().eq("id", id).eq("company_id", orgId));
    },

    /** One incident per failed response flagged creates_incident; idempotent across retries. */
    async openForFailures(orgId: string, ctx: FailureContext, failed: FailedResponse[]) {
      await assertAsset(orgId, ctx.item.asset_id);
      const now = new Date().toISOString();
      let created = 0;
      for (const r of failed) {
        let p = inflight.get(r.id);
        if (!p) {
          p = createOne(orgId, ctx, r, now).finally(() => inflight.delete(r.id));
          inflight.set(r.id, p);
          if (await p) created += 1;
        } else {
          await p; // a concurrent call is creating it: never count or create twice
        }
      }
      return created;
    },
  };
}

export type IncidentsRepo = ReturnType<typeof createIncidentsRepo>;
