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
import type { DueDecision, DuePreviewRow, ExternalRecord, InterventionPage, UpcomingRow } from "../../../contracts/repositories";
import { addMonthsClamped, planIntervalMonths, toOrgDate } from "../../../domain/due-date";
import { effectiveExecution, interventionScope } from "../../../domain/intervention";
import type { Json } from "@/integrations/supabase/types";
import type { StandaloneClient } from "../client";
import type { NewSession } from "../../../contracts/repositories";
export type { NewSession };
import { assertTransition, legacySessionOutcome } from "../../../domain/session-rules";
import { closeResults, historicalItem, historicalSession } from "../../../domain/session-history";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const DENY = "no encontrada en la organización activa";
type Meta = Record<string, unknown>;
const meta = (m: unknown): Meta => (m && typeof m === "object" && !Array.isArray(m) ? (m as Meta) : {});
const PAGE = 1000;
/** Reads every page (no silent 1000-row truncation); any page error aborts the whole read. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = ok(await page(from, from + PAGE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
const decisionsJson = (d: DueDecision[] | undefined) =>
  (d ?? []).map((x) => ({ item_id: x.itemId, action: x.action, due: x.due ?? null, reason: x.reason ?? null })) as unknown as Json;

export function createSessionsRepo(c: StandaloneClient) {
  const getOwn = async (orgId: string, sessionId: string) => {
    const s = ok(await c.from("maintenance_sessions").select("id, status, company_id, metadata")
      .eq("id", sessionId).eq("company_id", orgId).maybeSingle());
    if (!s) throw new Error(`Sesión ${DENY}`);
    return s;
  };
  const assertPlan = async (orgId: string, planId: string) => {
    const p = ok(await c.from("maintenance_plans")
      .select("id, code, name, frequency, interval_months, checklist_template_id, execution_mode, default_provider, scope_mode, scope_location_ids, scope_include_sublocations")
      .eq("id", planId).eq("company_id", orgId).maybeSingle());
    if (!p) throw new Error(`Plan ${DENY.replace("encontrada", "encontrado")}`);
    return p;
  };

  const orgTz = async (orgId: string): Promise<string> => {
    const r = await c.rpc("mnt_sa_org_tz", { p_company: orgId });
    return (!r.error && typeof r.data === "string" && r.data) || "Europe/Madrid";
  };

  return {
    async listSessions(orgId: string, status: string) {
      let q = c.from("maintenance_sessions").select("*, maintenance_plans(name, code)")
        .eq("company_id", orgId).order("created_at", { ascending: false }).limit(100);
      if (status !== "all") q = q.eq("status", status);
      return (ok(await q) ?? []).map(historicalSession);
    },
    /** Closed sessions are represented from their snapshot (see domain/session-history). */
    async getSession(orgId: string, id: string) {
      const s = ok(await c.from("maintenance_sessions").select("*, maintenance_plans(name, code)")
        .eq("id", id).eq("company_id", orgId).maybeSingle());
      return s ? historicalSession(s) : null;
    },
    async listItems(orgId: string, sessionId: string) {
      const s = await getOwn(orgId, sessionId);
      const frozen = closeResults(s.metadata);
      const rows = ok(await c.from("maintenance_items")
        .select("*, assets(id, code, name, manufacturer, model, location_id, locations(name), asset_type_id, asset_types(code, name_i18n))")
        .eq("session_id", sessionId).order("created_at")) ?? [];
      return rows.map((it) => historicalItem(it, s.status, frozen));
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
        .select("id, result, completed_at, created_at, observations, maintenance_sessions(id, code, status, closed_at, scheduled_for, company_id, plan_id, metadata, maintenance_plans(name))")
        .eq("asset_id", assetId).order("created_at", { ascending: false })) ?? [];
      return rows
        .filter((r) => (r.maintenance_sessions as { company_id?: string } | null)?.company_id === orgId)
        .map((r) => {
          const ms = r.maintenance_sessions ? historicalSession(r.maintenance_sessions) : null;
          const frozen = ms ? closeResults(ms.metadata).get(r.id) : undefined;
          return { ...r, result: ms && ms.history_source !== "live" && frozen ? frozen : r.result, maintenance_sessions: ms };
        });
    },

    /**
     * Opens a session from a plan. Idempotent by requestId: a retry finds the session already created
     * (metadata.client_request_id) and only inserts the items still missing.
     */
    async createSession(orgId: string, v: NewSession) {
      const plan = await assertPlan(orgId, v.planId);
      const links = ok(await c.from("maintenance_plan_assets")
        .select("asset_id, start_on, end_on, assets(id, code, name, status, deleted_at, manufacturer, model, company_id, asset_type_id, location_id, locations(name), asset_types(code, name_i18n))")
        .eq("plan_id", v.planId)) ?? [];
      type A = { id: string; code: string; name: string | null; status?: string; deleted_at?: string | null; manufacturer?: string | null; model?: string | null; company_id: string; asset_type_id: string; location_id: string | null; locations: { name: string } | null; asset_types: { code: string; name_i18n?: unknown } | null };
      const today = toOrgDate(new Date(), await orgTz(orgId));
      // Only links in force (started, not ended) and assets not retired/deleted enter an ordinary session.
      let rows = (links as Array<{ asset_id: string; start_on: string | null; end_on: string | null; assets: A | null }>).filter((pa) =>
        pa.assets && pa.assets.company_id === orgId && !pa.assets.deleted_at && pa.assets.status !== "retired"
        && (!pa.start_on || pa.start_on <= today) && (!pa.end_on || pa.end_on >= today));
      if (v.locationId) rows = rows.filter((pa) => pa.assets?.location_id === v.locationId);
      if (rows.length === 0) throw new Error("El plan no tiene equipos para esta selección");

      const typeMap = ok(await c.from("maintenance_plan_type_templates").select("asset_type_id, checklist_template_id").eq("plan_id", v.planId)) ?? [];
      const templateByType = new Map<string, string>(typeMap.map((t) => [t.asset_type_id, t.checklist_template_id]));
      const templateFor = (typeId: string) => templateByType.get(typeId) ?? plan.checklist_template_id;
      const external = plan.execution_mode === "external";
      const templateIds = external ? [] : [...new Set(rows.map((pa) => templateFor(pa.assets!.asset_type_id)).filter(Boolean) as string[])];
      const own = ok(await c.from("checklist_templates").select("id").eq("company_id", orgId).in("id", templateIds)) ?? [];
      const ownIds = (templateIds.length ? own : []).map((t) => t.id);
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
          is_external: external, external_provider: external ? plan.default_provider : null,
          metadata: { client_request_id: v.requestId, snapshot } as unknown as Json,
        }).select("id").single())!;
        sessionId = s.id;
      }
      const already = ok(await c.from("maintenance_items").select("asset_id").eq("session_id", sessionId!)) ?? [];
      const have = new Set(already.map((r) => r.asset_id));
      const items = rows.filter((pa) => !have.has(pa.asset_id)).map((pa) => {
        const a = pa.assets!;
        const tpl = external ? null : templateFor(a.asset_type_id);
        const ver = tpl ? versionByTemplate.get(tpl)! : null;
        return {
          session_id: sessionId!, asset_id: pa.asset_id, checklist_template_version_id: ver?.id ?? null, result: "pending",
          metadata: { snapshot: {
            asset: { id: a.id, code: a.code, name: a.name, asset_type_id: a.asset_type_id, type_code: a.asset_types?.code ?? null,
              type_name: ((n) => n?.es ?? n?.ca ?? n?.en ?? a.asset_types?.code ?? null)(a.asset_types?.name_i18n as Record<string, string> | null | undefined),
              manufacturer: a.manufacturer ?? null, model: a.model ?? null,
              location_id: a.location_id, location_name: a.locations?.name ?? null },
            checklist: ver ? { template_id: tpl, version_id: ver.id, version: ver.version } : null,
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

    /** Persisted next due per link in force; nothing is recalculated on read (Bloque 1B). */
    async listUpcoming(orgId: string): Promise<UpcomingRow[]> {
      const plans = ok(await c.from("maintenance_plans").select("id, code, name, frequency, interval_months, execution_mode")
        .eq("company_id", orgId).eq("active", true).is("deleted_at", null)) ?? [];
      if (!plans.length) return [];
      const planIds = plans.map((p) => p.id);
      const today = toOrgDate(new Date(), await orgTz(orgId));
      type L = { id: string; asset_id: string; plan_id: string; start_on: string | null; end_on: string | null; next_due_on: string | null;
        assets: { company_id: string; status: string; deleted_at: string | null } | null };
      type D = { asset_id: string; result: string; completed_at: string | null; maintenance_sessions: { plan_id: string | null } | null };
      type O = { id: string; plan_id: string; maintenance_items: Array<{ asset_id: string }> };
      const [links, done, open] = await Promise.all([
        readAll<L>((a, b) => c.from("maintenance_plan_assets")
          .select("id, asset_id, plan_id, start_on, end_on, next_due_on, assets(company_id, status, deleted_at)")
          .in("plan_id", planIds).order("id").range(a, b) as unknown as PromiseLike<{ data: L[] | null; error: unknown }>),
        // Last PERFORMED review per link: skipped / pending / global N/A never count as done.
        readAll<D>((a, b) => c.from("maintenance_items")
          .select("asset_id, result, completed_at, maintenance_sessions!inner(plan_id, status, company_id)")
          .eq("maintenance_sessions.company_id", orgId).eq("maintenance_sessions.status", "closed")
          .in("maintenance_sessions.plan_id", planIds).in("result", ["ok", "with_incident"]).not("completed_at", "is", null)
          .order("id").range(a, b) as unknown as PromiseLike<{ data: D[] | null; error: unknown }>),
        readAll<O>((a, b) => c.from("maintenance_sessions").select("id, plan_id, maintenance_items(asset_id)")
          .eq("company_id", orgId).in("status", ["draft", "in_progress"]).in("plan_id", planIds)
          .order("id").range(a, b) as unknown as PromiseLike<{ data: O[] | null; error: unknown }>),
      ]);
      const last = new Map<string, { at: string; result: string }>();
      for (const it of done) {
        const k = `${it.maintenance_sessions?.plan_id}|${it.asset_id}`; const cur = last.get(k);
        if (it.completed_at && (!cur || it.completed_at > cur.at)) last.set(k, { at: it.completed_at, result: it.result });
      }
      const openBy = new Map<string, string>();
      for (const s of open) for (const it of s.maintenance_items ?? []) openBy.set(`${s.plan_id}|${it.asset_id}`, s.id);
      const byId = new Map(plans.map((p) => [p.id, p]));
      return links
        .filter((l) => l.assets && l.assets.company_id === orgId && !l.assets.deleted_at && l.assets.status !== "retired"
          && (!l.end_on || l.end_on >= today))
        .map((l) => {
          const p = byId.get(l.plan_id)!; const k = `${l.plan_id}|${l.asset_id}`; const lr = last.get(k);
          return { asset_id: l.asset_id, plan_id: l.plan_id, plan_code: p.code, plan_name: p.name, frequency: p.frequency,
            interval_months: planIntervalMonths(p.frequency, p.interval_months), execution_mode: p.execution_mode,
            last_done_at: lr?.at ?? null, next_due_at: l.next_due_on, open_session_id: openBy.get(k) ?? null,
            plan_asset_id: l.id, scheduled: !!l.next_due_on, last_result: lr?.result ?? null,
            starts_on: l.start_on && l.start_on > today ? l.start_on : null };
        });
    },

    /** Same proposal rule the close function applies (server is authoritative; this is the preview). */
    async listDuePreview(orgId: string, sessionId: string): Promise<DuePreviewRow[]> {
      const s = ok(await c.from("maintenance_sessions").select("id, plan_id, is_external, metadata, maintenance_plans(frequency, interval_months)")
        .eq("id", sessionId).eq("company_id", orgId).maybeSingle());
      if (!s) throw new Error(`Sesión ${DENY}`);
      const tz = await orgTz(orgId);
      const plan = s.maintenance_plans as { frequency: string; interval_months: number | null } | null;
      const months = plan ? planIntervalMonths(plan.frequency, plan.interval_months) : null;
      const items = ok(await c.from("maintenance_items").select("id, asset_id, result, completed_at, metadata, assets(code, name)")
        .eq("session_id", sessionId).order("created_at")) ?? [];
      const links = s.plan_id ? ok(await c.from("maintenance_plan_assets").select("asset_id, next_due_on, end_on, created_at")
        .eq("plan_id", s.plan_id)) ?? [] : [];
      const planned = new Map<string, string | null>();
      for (const l of [...links].sort((a, b) => Number(!a.end_on) - Number(!b.end_on) || a.created_at.localeCompare(b.created_at)))
        planned.set(l.asset_id, l.next_due_on);
      return items.map((it) => {
        const a = it.assets as { code: string; name: string | null } | null;
        const snap = meta(meta(it.metadata).snapshot).asset as { code?: string; name?: string | null } | undefined;
        const performed = it.result === "ok" || it.result === "with_incident";
        const exec = performed && it.completed_at ? toOrgDate(it.completed_at, tz) : null;
        const p = planned.has(it.asset_id) ? planned.get(it.asset_id) ?? null : null;
        return { item_id: it.id, asset_id: it.asset_id, asset_code: a?.code ?? snap?.code ?? null, asset_name: a?.name ?? snap?.name ?? null,
          result: it.result, planned_on: p, executed_on: exec,
          proposed_on: exec && months ? addMonthsClamped(exec, months) : null,
          calendar_on: exec && p && months ? addMonthsClamped(p, months) : null, linked: planned.has(it.asset_id) };
      });
    },

    async listInterventions(orgId: string, page: { offset: number; limit: number }): Promise<InterventionPage> {
      const limit = Math.min(Math.max(1, Math.floor(page.limit)), 200), offset = Math.max(0, Math.floor(page.offset));
      const r = await c.from("maintenance_sessions")
        .select("id, code, plan_id, is_external, external_provider, outcome, closed_at, metadata, maintenance_plans(name, code), maintenance_items(completed_at)", { count: "exact" })
        .eq("company_id", orgId).eq("status", "closed")
        .order("closed_at", { ascending: false, nullsFirst: false }).order("id")
        .range(offset, offset + limit - 1);
      const rows = ok(r) ?? [];
      return {
        total: r.count ?? rows.length,
        rows: rows.map((s) => {
          const items = (s.maintenance_items ?? []) as Array<{ completed_at: string | null }>;
          const ex = effectiveExecution({ is_external: s.is_external, metadata: s.metadata, item_completions: items.map((i) => i.completed_at) });
          const plan = s.maintenance_plans as { name: string; code: string } | null;
          return {
            id: s.id, code: s.code, plan_id: s.plan_id, plan_name: plan?.name ?? null, plan_code: plan?.code ?? null,
            is_external: s.is_external, external_provider: s.external_provider, outcome: s.outcome,
            executed_on: ex.date, executed_source: ex.source, closed_at: s.closed_at,
            asset_count: interventionScope(s.metadata, items.length),
          };
        }),
      };
    },

    /** External review: common result + per-item exceptions + due dates + close, in one database transaction. */
    async recordExternal(orgId: string, sessionId: string, v: ExternalRecord) {
      await getOwn(orgId, sessionId);
      ok(await c.rpc("mnt_sa_record_external", {
        p_company: orgId, p_session: sessionId, p_performed_on: v.performedOn, p_provider: v.provider,
        p_reference: v.reference ?? "", p_result: v.result, p_description: v.description ?? "",
        p_exceptions: (v.exceptions ?? []).map((e) => ({ item_id: e.itemId, result: e.result, note: e.note ?? null })) as unknown as Json,
        p_decisions: decisionsJson(v.decisions),
      }));
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
     * in_progress → closed in ONE database transaction (mnt_sa_close_session): pending items become skipped,
     * outcome + close_snapshot are stored and each item's due decision is applied with its log row.
     * Idempotent: a repeated close returns closedNow=false and changes nothing.
     */
    async closeSession(orgId: string, sessionId: string, v: { signerName: string; signerRole: string | null; signature: string; decisions?: DueDecision[] }) {
      const before = await getOwn(orgId, sessionId);
      if (before.status !== "closed") assertTransition(before.status, "closed");
      const r = ok(await c.rpc("mnt_sa_close_session", {
        p_company: orgId, p_session: sessionId, p_signer_name: v.signerName, p_signer_role: v.signerRole ?? "",
        p_signature: v.signature, p_decisions: decisionsJson(v.decisions),
      })) as { closed_now?: boolean; pending_count?: number } | null;
      const session = ok(await c.from("maintenance_sessions")
        .select("*, maintenance_plans(name, interval_months, asset_families(requires_certificate))")
        .eq("id", sessionId).eq("company_id", orgId).maybeSingle());
      if (!session) throw new Error(`Sesión ${DENY}`);
      const items = ok(await c.from("maintenance_items").select("id, asset_id, result, observations, metadata").eq("session_id", sessionId)) ?? [];
      return { closedNow: !!r?.closed_now, session, items, pendingCount: Number(r?.pending_count ?? 0) };
    },
  };
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>;
