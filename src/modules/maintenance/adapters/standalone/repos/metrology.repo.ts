/**
 * Metrology repository over the mnt_mtr_* tables. Every read/write is filtered by company_id = orgId
 * and ids are checked against the org before calling the atomic database operations (the authority).
 */
import type { StandaloneClient } from "../client";
import type {
  MetrologyContract, MtrControlPlan, MtrEquipment, MtrEquipmentInput, MtrHistoryEntry, MtrImpactReview, MtrRecord, MtrRecordLine,
} from "../../../contracts/metrology";
import type { MtrStoredStatus } from "../../../domain/metrology";

const ok = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };
const CROSS = "El recurso no pertenece a la organización activa";
type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toEq = (r: R): MtrEquipment => ({
  id: r.id, orgId: r.company_id, code: r.code, name: r.name, equipmentType: r.equipment_type, magnitude: r.magnitude,
  intendedUse: r.intended_use, siteId: r.site_id, locationDetail: r.location_detail, responsibleRef: r.responsible_ref,
  brand: r.brand, model: r.model, serialNumber: r.serial_number, rangeMin: r.range_min, rangeMax: r.range_max, unit: r.unit,
  resolution: r.resolution, declaredAccuracy: r.declared_accuracy, restrictions: r.restrictions, allowedUses: r.allowed_uses,
  registeredOn: r.registered_on, status: r.status,
});
const fromEq = (v: Partial<MtrEquipmentInput>): R => {
  const m: R = {
    name: v.name, equipment_type: v.equipmentType, magnitude: v.magnitude, intended_use: v.intendedUse, site_id: v.siteId,
    location_detail: v.locationDetail, responsible_ref: v.responsibleRef, brand: v.brand, model: v.model,
    serial_number: v.serialNumber, range_min: v.rangeMin, range_max: v.rangeMax, unit: v.unit, resolution: v.resolution,
    declared_accuracy: v.declaredAccuracy, restrictions: v.restrictions, registered_on: v.registeredOn,
  };
  Object.keys(m).forEach((k) => m[k] === undefined && delete m[k]);
  return m;
};
const toPlan = (r: R): MtrControlPlan => ({
  id: r.id, equipmentId: r.equipment_id, kind: r.control_kind, method: r.method, procedure: r.procedure,
  frequencyUnit: r.frequency_unit, frequencyValue: r.frequency_value, acceptanceCriteria: r.acceptance_criteria,
  responsibleRef: r.responsible_ref, nextDueOn: r.next_due_on, requiresDocument: r.requires_document,
  qualifiesAsReference: r.qualifies_as_reference, active: r.active,
});
const toRec = (r: R): MtrRecord => ({
  id: r.id, equipmentId: r.equipment_id, controlPlanId: r.control_plan_id, kind: r.kind, performedOn: r.performed_on,
  performerRef: r.performer_ref, result: r.result, nextDueCalculated: r.next_due_calculated, nextDueOverride: r.next_due_override,
  overrideReason: r.override_reason, observations: r.observations, documentRef: r.document_ref, status: r.status,
  version: r.version, supersedesId: r.supersedes_id, validatedAt: r.validated_at, laboratory: r.laboratory,
  certificateNumber: r.certificate_number, accreditation: r.accreditation, declaredUncertainty: r.declared_uncertainty,
  adjustedOrRepaired: r.adjusted_or_repaired, referenceEquipmentId: r.reference_equipment_id,
});
const toLine = (r: R): MtrRecordLine => ({
  position: r.position, label: r.label, referenceValue: r.reference_value, measuredValue: r.measured_value,
  tolerance: r.tolerance, result: r.result,
});
const toImpact = (r: R): MtrImpactReview => ({
  id: r.id, equipmentId: r.equipment_id, recordId: r.record_id, status: r.status, conclusion: r.conclusion,
  justification: r.justification, actions: r.actions_taken_or_planned, periodReviewed: r.period_reviewed, reviewedOn: r.reviewed_on,
  externalRef: r.external_ref_type ? { type: r.external_ref_type, id: r.external_ref_id, label: r.external_ref_label, url: r.external_ref_url } : null,
});

export function createMetrologyRepo(client: StandaloneClient): MetrologyContract {
  const db = client as unknown as { from: (t: string) => any; rpc: (f: string, a: R) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const owned = async (table: string, orgId: string, id: string) => {
    const row = ok(await db.from(table).select("id").eq("company_id", orgId).eq("id", id).maybeSingle());
    if (!row) throw new Error(CROSS);
  };

  return {
    async listEquipment(orgId) {
      return (ok(await db.from("mnt_mtr_equipment").select("*").eq("company_id", orgId).is("deleted_at", null).order("code")) as R[]).map(toEq);
    },
    async getEquipment(orgId, id) {
      const r = ok(await db.from("mnt_mtr_equipment").select("*").eq("company_id", orgId).eq("id", id).maybeSingle());
      if (!r) throw new Error("Equipo no encontrado");
      return toEq(r);
    },
    async createEquipment(orgId, v) {
      const code = ok(await db.rpc("next_code", { p_company_id: orgId, p_scope: "mtr", p_prefix: "MTR" })) as string;
      const r = ok(await db.from("mnt_mtr_equipment").insert({ ...fromEq(v), company_id: orgId, code }).select("id").single());
      return r.id;
    },
    async updateEquipment(orgId, id, v) {
      const patch = fromEq(v);
      delete patch.site_id; // site changes go through moveSite (traced)
      ok(await db.from("mnt_mtr_equipment").update(patch).eq("company_id", orgId).eq("id", id));
    },
    async listPlans(orgId, equipmentId) {
      return (ok(await db.from("mnt_mtr_control_plans").select("*").eq("company_id", orgId).eq("equipment_id", equipmentId).order("created_at")) as R[]).map(toPlan);
    },
    async savePlan(orgId, equipmentId, planId, v) {
      const row = {
        control_kind: v.kind, method: v.method, procedure: v.procedure, frequency_unit: v.frequencyUnit,
        frequency_value: v.frequencyValue, acceptance_criteria: v.acceptanceCriteria, responsible_ref: v.responsibleRef,
        next_due_on: v.nextDueOn, requires_document: v.requiresDocument, qualifies_as_reference: v.qualifiesAsReference, active: v.active,
      };
      if (planId) {
        ok(await db.from("mnt_mtr_control_plans").update(row).eq("company_id", orgId).eq("id", planId).eq("equipment_id", equipmentId));
        return planId;
      }
      await owned("mnt_mtr_equipment", orgId, equipmentId);
      return ok(await db.from("mnt_mtr_control_plans").insert({ ...row, company_id: orgId, equipment_id: equipmentId }).select("id").single()).id;
    },
    async listRecords(orgId, equipmentId) {
      return (ok(await db.from("mnt_mtr_records").select("*").eq("company_id", orgId).eq("equipment_id", equipmentId).order("performed_on", { ascending: false })) as R[]).map(toRec);
    },
    async getRecordLines(orgId, recordId) {
      return (ok(await db.from("mnt_mtr_record_lines").select("*").eq("company_id", orgId).eq("record_id", recordId).order("position")) as R[]).map(toLine);
    },
    async saveDraft(orgId, equipmentId, recordId, v) {
      const row = {
        control_plan_id: v.controlPlanId, kind: v.kind, performed_on: v.performedOn, performer_ref: v.performerRef,
        result: v.result, next_due_override: v.nextDueOverride, override_reason: v.overrideReason, observations: v.observations,
        document_ref: v.documentRef, laboratory: v.laboratory, certificate_number: v.certificateNumber, accreditation: v.accreditation,
        declared_uncertainty: v.declaredUncertainty, adjusted_or_repaired: v.adjustedOrRepaired, reference_equipment_id: v.referenceEquipmentId,
      };
      let id = recordId;
      if (id) {
        ok(await db.from("mnt_mtr_records").update(row).eq("company_id", orgId).eq("id", id).eq("status", "draft"));
        ok(await db.from("mnt_mtr_record_lines").delete().eq("company_id", orgId).eq("record_id", id));
      } else {
        await owned("mnt_mtr_equipment", orgId, equipmentId);
        id = ok(await db.from("mnt_mtr_records").insert({ ...row, company_id: orgId, equipment_id: equipmentId }).select("id").single()).id as string;
      }
      if (v.lines.length) {
        ok(await db.from("mnt_mtr_record_lines").insert(v.lines.map((l) => ({
          company_id: orgId, record_id: id, position: l.position, label: l.label, reference_value: l.referenceValue,
          measured_value: l.measuredValue, tolerance: l.tolerance, result: l.result,
        }))));
      }
      return id!;
    },
    async validateRecord(orgId, recordId) {
      await owned("mnt_mtr_records", orgId, recordId);
      return ok(await db.rpc("mtr_validate_record", { p_record: recordId }));
    },
    async rectifyRecord(orgId, recordId, reason) {
      await owned("mnt_mtr_records", orgId, recordId);
      return ok(await db.rpc("mtr_rectify_record", { p_record: recordId, p_reason: reason }));
    },
    async decideUnfit(orgId, recordId, decision, notes, allowedUses) {
      await owned("mnt_mtr_records", orgId, recordId);
      return ok(await db.rpc("mtr_decide_unfit", { p_record: recordId, p_decision: decision, p_notes: notes, p_allowed_uses: allowedUses })) as MtrStoredStatus;
    },
    async listImpactReviews(orgId, equipmentId) {
      let q = db.from("mnt_mtr_impact_reviews").select("*").eq("company_id", orgId);
      if (equipmentId) q = q.eq("equipment_id", equipmentId);
      return (ok(await q.order("created_at", { ascending: false })) as R[]).map(toImpact);
    },
    async closeImpact(orgId, reviewId, v) {
      await owned("mnt_mtr_impact_reviews", orgId, reviewId);
      ok(await db.rpc("mtr_close_impact", {
        p_review: reviewId, p_conclusion: v.conclusion, p_justification: v.justification, p_actions: v.actions,
        p_period: v.periodReviewed, p_reviewed_on: v.reviewedOn, p_ext_type: v.externalRef?.type ?? null,
        p_ext_id: v.externalRef?.id ?? null, p_ext_label: v.externalRef?.label ?? null, p_ext_url: v.externalRef?.url ?? null,
      }));
    },
    async moveSite(orgId, equipmentId, siteId, locationDetail, note) {
      await owned("mnt_mtr_equipment", orgId, equipmentId);
      ok(await db.rpc("mtr_move_site", { p_equipment: equipmentId, p_site: siteId, p_location_detail: locationDetail, p_note: note }));
    },
    async setStatus(orgId, equipmentId, status, reason) {
      await owned("mnt_mtr_equipment", orgId, equipmentId);
      ok(await db.rpc("mtr_set_status", { p_equipment: equipmentId, p_status: status, p_reason: reason }));
    },
    async listHistory(orgId, equipmentId) {
      const [st, mv, dc] = await Promise.all([
        db.from("mnt_mtr_status_history").select("*").eq("company_id", orgId).eq("equipment_id", equipmentId),
        db.from("mnt_mtr_site_moves").select("*").eq("company_id", orgId).eq("equipment_id", equipmentId),
        db.from("mnt_mtr_unfit_decisions").select("*").eq("company_id", orgId).eq("equipment_id", equipmentId),
      ]);
      const out: MtrHistoryEntry[] = [
        ...(ok(st) as R[]).map((r) => ({ kind: "status" as const, at: r.changed_at, from: r.from_status, to: r.to_status, cause: r.cause, note: r.note, recordId: r.record_id })),
        ...(ok(mv) as R[]).map((r) => ({ kind: "site_move" as const, at: r.moved_at, fromSiteId: r.from_site_id, toSiteId: r.to_site_id, note: r.note })),
        ...(ok(dc) as R[]).map((r) => ({ kind: "decision" as const, at: r.decided_at, decision: r.decision, notes: r.notes, recordId: r.record_id })),
      ];
      return out.sort((a, b) => b.at.localeCompare(a.at));
    },
  };
}
