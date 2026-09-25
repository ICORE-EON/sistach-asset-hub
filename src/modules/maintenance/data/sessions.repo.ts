/**
 * Maintenance sessions repository: sessions, their items, per-item results, state transitions and the
 * plan/asset relations needed to open a session. maintenance_sessions carries company_id; items are
 * reached only through a session proven to belong to orgId. Writes are conditional on the current
 * status so retries/reloads never double-start, double-close or duplicate items.
 *
 * Historical snapshots are written into the existing `metadata` jsonb columns (no schema change):
 *  - session.metadata.snapshot: plan as it was when the session was opened
 *  - item.metadata.snapshot: asset, type, location and checklist version at opening
 *  - session.metadata.close_snapshot: per-item results frozen at close
 */
import type { Json } from "@/integrations/supabase/types";
import type { StandaloneClient } from "../adapters/standalone/client";
import { assertTransition, legacySessionOutcome } from "../domain/session-rules";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const DENY = "no encontrada en la organización activa";
type Meta = Record<string, unknown>;
const meta = (m: unknown): Meta => (m && typeof m === "object" && !Array.isArray(m) ? (m as Meta) : {});

export type NewSession = {
  requestId: string; planId: string; locationId: string | null;
  scheduledFor: string | null; technicianName: string | null;
};

export function createSessionsRepo(c: StandaloneClient) {
  const getOwn = async (orgId: string, sessionId: string) => {
    const s = ok(await c.from("maintenance_sessions").select("id, status, company_id, metadata")
      .eq("id", sessionId).eq("company_id", orgId).maybeSingle());
    if (!s) throw new Error(`Sesión ${DENY}`);
    return s;
  };
  const assertPlan = async (orgId: string, planId: string) => {
    const p = ok(await c.from("maintenance_plans")
      .select("id, code, name, frequency, interval_months, checklist_template_id, scope_mode, scope_location_ids, scope_include_sublocations")
      .eq("id", planId).eq("company_id", orgId).maybeSingle());
    if (!p) throw new Error(`Plan ${DENY.replace("encontrada", "encontrado")}`);
    return p;
  };

  return {
    async listSessions(orgId: string, status: string) {
      let q = c.from("maintenance_sessions").select("*, maintenance_plans(name, code)")
        .eq("company_id", orgId).order("created_at", { ascending: false }).limit(100);
      if (status !== "all") q = q.eq("status", status);
      return ok(await q) ?? [];
    },
    async getSession(orgId: string, id: string) {
      return ok(await c.from("maintenance_sessions").select("*, maintenance_plans(name, code)")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
    },
    async listItems(orgId: string, sessionId: string) {
      await getOwn(orgId, sessionId);
      return ok(await c.from("maintenance_items")
        .select("*, assets(id, code, name, manufacturer, model, location_id, locations(name), asset_type_id, asset_types(code, name_i18n))")
        .eq("session_id", sessionId).order("created_at")) ?? [];
    },
    async listPlansForSession(orgId: string) {
      return ok(await c.from("maintenance_plans")
        .select("id, code, name, checklist_template_id, asset_family_id, asset_families(code, name_i18n), checklist_templates(name, current_version)")
        .eq("company_id", orgId).eq("active", true).is("deleted_at", null).order("name")) ?? [];
    },
    async listPlanLocations(orgId: string, planId: string) {
      await assertPlan(orgId, planId);
      const rows = ok(await c.from("maintenance_plan_assets").select("assets(location_id, locations(name))").eq("plan_id", planId)) ?? [];
      const map = new Map<string, string>();
      for (const row of rows as Array<{ assets: { location_id: string | null; locations: { name: string } | null } | null }>) {
        const loc = row.assets?.location_id;
        if (loc) map.set(loc, row.assets?.locations?.name ?? "Ubicación");
      }
      return [...map.entries()].map(([id, name]) => ({ id, name }));
    },
    /** Maintenance history of one asset (sessions of the org only). */
    async listAssetHistory(orgId: string, assetId: string) {
      const a = ok(await c.from("assets").select("id").eq("id", assetId).eq("company_id", orgId).maybeSingle());
      if (!a) throw new Error("Activo no encontrado en la organización activa");
      const rows = ok(await c.from("maintenance_items")
        .select("id, result, completed_at, created_at, observations, maintenance_sessions(id, code, status, closed_at, scheduled_for, company_id, maintenance_plans(name))")
        .eq("asset_id", assetId).order("created_at", { ascending: false })) ?? [];
      return rows.filter((r) => (r.maintenance_sessions as { company_id?: string } | null)?.company_id === orgId);
    },

    /**
     * Opens a session from a plan. Idempotent by requestId: a retry finds the session already created
     * (metadata.client_request_id) and only inserts the items still missing.
     */
    async createSession(orgId: string, v: NewSession) {
      const plan = await assertPlan(orgId, v.planId);
      const links = ok(await c.from("maintenance_plan_assets")
        .select("asset_id, assets(id, code, name, company_id, asset_type_id, location_id, locations(name), asset_types(code))")
        .eq("plan_id", v.planId)) ?? [];
      type A = { id: string; code: string; name: string | null; company_id: string; asset_type_id: string; location_id: string | null; locations: { name: string } | null; asset_types: { code: string } | null };
      let rows = (links as Array<{ asset_id: string; assets: A | null }>).filter((pa) => pa.assets && pa.assets.company_id === orgId);
      if (v.locationId) rows = rows.filter((pa) => pa.assets?.location_id === v.locationId);
      if (rows.length === 0) throw new Error("El plan no tiene equipos para esta selección");

      const typeMap = ok(await c.from("maintenance_plan_type_templates").select("asset_type_id, checklist_template_id").eq("plan_id", v.planId)) ?? [];
      const templateByType = new Map<string, string>(typeMap.map((t) => [t.asset_type_id, t.checklist_template_id]));
      const templateFor = (typeId: string) => templateByType.get(typeId) ?? plan.checklist_template_id;
      const templateIds = [...new Set(rows.map((pa) => templateFor(pa.assets!.asset_type_id)))];
      const own = ok(await c.from("checklist_templates").select("id").eq("company_id", orgId).in("id", templateIds)) ?? [];
      const ownIds = own.map((t) => t.id);
      const vers = ownIds.length ? ok(await c.from("checklist_template_versions").select("id, version, template_id")
        .in("template_id", ownIds).eq("is_published", true).order("version", { ascending: false })) ?? [] : [];
      const versionByTemplate = new Map<string, { id: string; version: number }>();
      for (const x of vers) if (!versionByTemplate.has(x.template_id)) versionByTemplate.set(x.template_id, { id: x.id, version: x.version });
      if (templateIds.some((t) => !versionByTemplate.has(t)))
        throw new Error("Hay tipos de activo cuya plantilla no tiene versión publicada");

      const existing = ok(await c.from("maintenance_sessions").select("id").eq("company_id", orgId)
        .filter("metadata->>client_request_id", "eq", v.requestId).maybeSingle());
      let sessionId = existing?.id as string | undefined;
      if (!sessionId) {
        const code = ok(await c.rpc("next_code", { p_company_id: orgId, p_scope: "maintenance_sessions", p_prefix: "MTS" }));
        const snapshot = {
          plan: {
            id: plan.id, code: plan.code, name: plan.name, frequency: plan.frequency, interval_months: plan.interval_months,
            scope_mode: plan.scope_mode, scope_location_ids: plan.scope_location_ids, scope_include_sublocations: plan.scope_include_sublocations,
          },
          captured_at: new Date().toISOString(),
        };
        const s = ok(await c.from("maintenance_sessions").insert({
          company_id: orgId, code: code as string, plan_id: v.planId, location_id: v.locationId,
          scheduled_for: v.scheduledFor, technician_name: v.technicianName, status: "draft",
          metadata: { client_request_id: v.requestId, snapshot } as unknown as Json,
        }).select("id").single())!;
        sessionId = s.id;
      }
      const already = ok(await c.from("maintenance_items").select("asset_id").eq("session_id", sessionId!)) ?? [];
      const have = new Set(already.map((r) => r.asset_id));
      const items = rows.filter((pa) => !have.has(pa.asset_id)).map((pa) => {
        const a = pa.assets!;
        const tpl = templateFor(a.asset_type_id);
        const ver = versionByTemplate.get(tpl)!;
        return {
          session_id: sessionId!, asset_id: pa.asset_id, checklist_template_version_id: ver.id, result: "pending",
          metadata: { snapshot: {
            asset: { id: a.id, code: a.code, name: a.name, asset_type_id: a.asset_type_id, type_code: a.asset_types?.code ?? null,
              location_id: a.location_id, location_name: a.locations?.name ?? null },
            checklist: { template_id: tpl, version_id: ver.id, version: ver.version },
          } } as unknown as Json,
        };
      });
      if (items.length) ok(await c.from("maintenance_items").insert(items));
      return sessionId!;
    },

    /** draft → in_progress; a repeated start on an already started session is a no-op. */
    async startSession(orgId: string, sessionId: string) {
      const s = await getOwn(orgId, sessionId);
      if (s.status === "in_progress") return false;
      assertTransition(s.status, "in_progress");
      const upd = ok(await c.from("maintenance_sessions").update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", sessionId).eq("company_id", orgId).eq("status", "draft").select("id")) ?? [];
      return upd.length > 0;
    },

    /** Item must belong to a session of the org that is in progress. */
    async assertItemWritable(orgId: string, sessionId: string, itemId: string) {
      const s = await getOwn(orgId, sessionId);
      if (s.status !== "in_progress") throw new Error(s.status === "draft" ? "La sesión no está iniciada" : "La sesión está cerrada");
      const it = ok(await c.from("maintenance_items").select("id, asset_id, metadata").eq("id", itemId).eq("session_id", sessionId).maybeSingle());
      if (!it) throw new Error(`Equipo de sesión ${DENY.replace("encontrada", "encontrado")}`);
      return it;
    },
    async setItemResult(orgId: string, sessionId: string, itemId: string, result: string, observations: string | null, failCount: number) {
      const it = await this.assertItemWritable(orgId, sessionId, itemId);
      const now = new Date().toISOString();
      ok(await c.from("maintenance_items").update({
        result, observations, completed_at: now,
        metadata: { ...meta(it.metadata), completion: { result, fail_count: failCount, at: now } } as unknown as Json,
      }).eq("id", itemId).eq("session_id", sessionId));
    },

    /**
     * in_progress → closed. Pending items become skipped, outcome is stored as before and per-item
     * results are frozen in close_snapshot. The final update is conditional on status = in_progress,
     * so a second close (retry, reload, double click) never re-closes. Returns closedNow=false then.
     */
    async closeSession(orgId: string, sessionId: string, v: { signerName: string; signerRole: string | null; signature: string }) {
      const session = ok(await c.from("maintenance_sessions")
        .select("*, maintenance_plans(name, interval_months, asset_families(requires_certificate))")
        .eq("id", sessionId).eq("company_id", orgId).maybeSingle());
      if (!session) throw new Error(`Sesión ${DENY}`);
      const items = (ok(await c.from("maintenance_items").select("id, asset_id, result, observations, metadata").eq("session_id", sessionId)) ?? [])
        .map((i) => ({ ...i }));
      if (session.status === "closed") {
        const skipped = Number(meta(session.metadata).skipped_count ?? 0);
        return { closedNow: false, session, items, pendingCount: skipped };
      }
      assertTransition(session.status, "closed");

      const pendingIds = items.filter((i) => i.result === "pending").map((i) => i.id);
      if (pendingIds.length) {
        ok(await c.from("maintenance_items").update({ result: "skipped" }).in("id", pendingIds).eq("session_id", sessionId).eq("result", "pending"));
        for (const it of items) if (it.result === "pending") it.result = "skipped";
      }
      const outcome = legacySessionOutcome(items.map((i) => i.result), pendingIds.length);
      const closedAt = new Date().toISOString();
      const close_snapshot = {
        at: closedAt,
        items: items.map((i) => ({ item_id: i.id, asset_id: i.asset_id, result: i.result, asset: meta(meta(i.metadata).snapshot).asset ?? null })),
      };
      const upd = ok(await c.from("maintenance_sessions").update({
        status: "closed", closed_at: closedAt, signer_name: v.signerName, signer_role: v.signerRole,
        signature_image_url: v.signature,
        metadata: { ...meta(session.metadata), outcome, skipped_count: pendingIds.length, close_snapshot } as unknown as Json,
      }).eq("id", sessionId).eq("company_id", orgId).eq("status", "in_progress").select("id")) ?? [];
      return { closedNow: upd.length > 0, session, items, pendingCount: pendingIds.length };
    },
  };
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>;
