/**
 * Metrology (measuring equipment) data capability. Module-owned DTOs, not table shapes.
 * Every call receives orgId explicitly. State transitions are decided by the database
 * operations (validate/rectify/decideUnfit/closeImpact/moveSite/setStatus); adapters must
 * call them and accept their result.
 */
import type { MtrFrequencyUnit, MtrImpactConclusion, MtrStoredStatus, MtrUnfitDecision } from "../domain/metrology";

export type MtrControlKind = "calibration" | "verification" | "check";
export type MtrMethod = "external" | "internal";
export type MtrResult = "fit" | "unfit" | "restricted";
export type MtrLineResult = "fit" | "unfit";
export type MtrCriterionMode = "absolute" | "percentage" | "manual";
/** Criterio de aceptación de un valor verificado (magnitud + unidad). tolerance: absoluta o en %; manual: description. */
export type MtrCriterion = { key: string; magnitude: string; unit: string; mode: MtrCriterionMode; tolerance: number | null; description: string | null };

export type MtrEquipment = {
  id: string; orgId: string; code: string; name: string; equipmentType: string;
  magnitude: string | null; intendedUse: string | null; siteId: string; locationDetail: string | null;
  responsibleRef: string | null; brand: string | null; model: string | null; serialNumber: string | null;
  rangeMin: number | null; rangeMax: number | null; unit: string | null; resolution: string | null;
  declaredAccuracy: string | null; restrictions: string | null; allowedUses: string | null;
  registeredOn: string; status: MtrStoredStatus;
  /** Optional physical identity in the asset inventory (same org, set once). */
  assetId: string | null;
  /** When linked, code/name/location come from the asset (source of truth). */
  asset: MtrLinkedAsset | null;
  /** Operational association, NOT physical identity. Several instruments may share it. */
  parentAssetId: string | null;
  parentAsset: MtrLinkedAsset | null;
};
export type MtrLinkedAsset = { id: string; code: string; name: string | null; typeName: string | null; locationName: string | null };
export type MtrEquipmentInput = Omit<MtrEquipment, "id" | "orgId" | "code" | "status" | "registeredOn" | "assetId" | "asset" | "parentAssetId" | "parentAsset"> & { registeredOn?: string; assetId?: string | null; parentAssetId?: string | null };

export type MtrControlPlan = {
  id: string; equipmentId: string; kind: MtrControlKind; method: MtrMethod; procedure: string | null;
  frequencyUnit: MtrFrequencyUnit; frequencyValue: number | null; acceptanceCriteria: string | null;
  responsibleRef: string | null; nextDueOn: string | null; requiresDocument: boolean;
  qualifiesAsReference: boolean; active: boolean; criteria: MtrCriterion[];
};
export type MtrControlPlanInput = Omit<MtrControlPlan, "id" | "equipmentId">;

export type MtrRecordLine = {
  position: number; label: string; referenceValue: number | null; measuredValue: number | null;
  tolerance: number | null; result: MtrLineResult | null;
  criterionKey: string | null; mode: MtrCriterionMode; errorValue: number | null;
};
export type MtrRecord = {
  id: string; equipmentId: string; controlPlanId: string; kind: MtrControlKind; performedOn: string;
  performerRef: string | null; result: MtrResult | null; nextDueCalculated: string | null;
  nextDueOverride: string | null; overrideReason: string | null; observations: string | null;
  documentRef: string | null; status: "draft" | "validated" | "superseded"; version: number;
  supersedesId: string | null; validatedAt: string | null;
  laboratory: string | null; certificateNumber: string | null; accreditation: string | null;
  declaredUncertainty: string | null; adjustedOrRepaired: boolean | null; referenceEquipmentId: string | null;
  restrictions: string | null;
  rectificationReason?: string | null;
};
export type MtrRecordDraft = Omit<MtrRecord, "id" | "equipmentId" | "status" | "version" | "supersedesId" | "validatedAt" | "nextDueCalculated"> & { lines: MtrRecordLine[] };

export type MtrImpactReview = {
  id: string; equipmentId: string; recordId: string; status: "pending" | "evaluated";
  conclusion: MtrImpactConclusion | null; justification: string | null; actions: string | null;
  periodReviewed: string | null; reviewedOn: string | null;
  externalRef: { type: string; id: string | null; label: string | null; url: string | null } | null;
};
export type MtrImpactCloseInput = {
  conclusion: MtrImpactConclusion; justification: string; actions: string | null; periodReviewed: string | null;
  reviewedOn: string; externalRef: { type: "nc" | "action"; id: string | null; label: string | null; url: string | null } | null;
};

export type MtrHistoryEntry =
  | { kind: "status"; at: string; from: string | null; to: string; cause: string; note: string | null; recordId: string | null }
  | { kind: "site_move"; at: string; fromSiteId: string | null; toSiteId: string; note: string | null }
  | { kind: "decision"; at: string; decision: string; notes: string | null; recordId: string };

export type MtrEquipmentSummary = MtrEquipment & { nextDueOn: string | null; pendingImpact: boolean; lastResult: MtrResult | null };
export type MtrSite = { id: string; name: string; code: string };
/** Persona de la organización (person_ref). En ICORE corresponde a la persona canónica de la org. */
export type MtrPerson = { id: string; name: string };

export interface MetrologyContract {
  listSites(orgId: string): Promise<MtrSite[]>;
  listPeople(orgId: string): Promise<MtrPerson[]>;
  listEquipment(orgId: string): Promise<MtrEquipmentSummary[]>;
  getEquipment(orgId: string, id: string): Promise<MtrEquipment>;
  createEquipment(orgId: string, v: MtrEquipmentInput): Promise<string>;
  updateEquipment(orgId: string, id: string, v: Partial<MtrEquipmentInput>): Promise<void>;
  listPlans(orgId: string, equipmentId: string): Promise<MtrControlPlan[]>;
  savePlan(orgId: string, equipmentId: string, planId: string | null, v: MtrControlPlanInput): Promise<string>;
  listRecords(orgId: string, equipmentId: string): Promise<MtrRecord[]>;
  getRecordLines(orgId: string, recordId: string): Promise<MtrRecordLine[]>;
  saveDraft(orgId: string, equipmentId: string, recordId: string | null, v: MtrRecordDraft): Promise<string>;
  validateRecord(orgId: string, recordId: string): Promise<{ result: MtrResult | null; [k: string]: unknown }>;
  rectifyRecord(orgId: string, recordId: string, reason: string): Promise<string>;
  decideUnfit(orgId: string, recordId: string, decision: MtrUnfitDecision, notes: string | null, allowedUses: string | null): Promise<MtrStoredStatus>;
  listImpactReviews(orgId: string, equipmentId: string | null): Promise<MtrImpactReview[]>;
  closeImpact(orgId: string, reviewId: string, v: MtrImpactCloseInput): Promise<void>;
  moveSite(orgId: string, equipmentId: string, siteId: string, locationDetail: string | null, note: string | null): Promise<void>;
  setStatus(orgId: string, equipmentId: string, status: MtrStoredStatus, reason: string): Promise<void>;
  listHistory(orgId: string, equipmentId: string): Promise<MtrHistoryEntry[]>;
  /** Metrology equipment id linked to the asset, or null. */
  findByAsset(orgId: string, assetId: string): Promise<string | null>;
  /** Assets of the org not yet linked to any metrology equipment. */
  listLinkableAssets(orgId: string): Promise<MtrLinkedAsset[]>;
  /** Links an unlinked equipment to an asset (same org; set once, enforced by the database). */
  linkAsset(orgId: string, equipmentId: string, assetId: string): Promise<void>;
  getInventoryAsset(orgId: string, assetId: string): Promise<MtrLinkedAsset>;
  /** Atomic, idempotent batch; reject any unavailable/cross-org/already-associated instrument. */
  associateEquipment(orgId: string, parentAssetId: string, equipmentIds: string[]): Promise<void>;
}
