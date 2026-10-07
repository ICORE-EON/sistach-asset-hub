/**
 * Stable data contracts of the maintenance module (capabilities, not tables).
 *
 * Every operation receives the organisation explicitly as its first argument
 * (and the acting user where it matters); implementations must never read an
 * ambient "active organisation". DTO field names are the module's view model:
 * each host adapter (standalone app, ICORE) maps its own storage onto them.
 * This file must not import any host infrastructure (database client, routes,
 * app contexts, browser File/Blob).
 */
import type { ScopeAsset, ScopeLocation } from "../domain/scope";
import type { HistorySource } from "../domain/session-history";
import type { CertificateSnapshot, TemplateSourceKind } from "../domain/certificate-rules";
import type { CertificateTemplate } from "../domain/certificate-templates/types";

/** JSON value as stored by the module (structurally identical to any JSON column type). */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Binary payload handed to adapters; never a browser File/Blob. */
export type BinaryUpload = { name: string; contentType: string; size: number; bytes: Uint8Array };

// ---- input DTOs ----
export type AssetFilters = {
  status?: string; typeIds?: string[] | null; siteId?: string; q?: string;
};
export type NewAsset = {
  asset_type_id: string; location_id: string | null; name: string | null;
  manufacturer: string | null; model: string | null; serial_number: string | null;
  install_date: string | null; notes: string | null;
};
export type AssetPatch = NewAsset & { warranty_until: string | null; status: string };
export type KitItemInput = {
  product_code: string | null; product_name: string; quantity: number;
  unit: string | null; batch_code?: string | null; expires_on?: string | null; notes?: string | null;
};
export type TemplateScopeInput = {
  asset_family_id: string | null; asset_type_ids: string[]; location_ids: string[]; include_sublocations: boolean;
};
export type NewTemplate = TemplateScopeInput & { code: string; name: string; description: string | null };
export type NewQuestion = {
  position: number; prompt: string; help_text: string | null; response_type: string;
  required: boolean; creates_incident: boolean; options: Json | null;
};
export type ResponseInput = { question_id: string; answer: unknown; is_fail: boolean; observations: string | null };
export type NewPlan = {
  code: string; name: string; asset_family_id: string; frequency: string; interval_months: number | null;
  notes: string | null; scope_mode: "scoped" | "manual"; scope_location_ids: string[];
  scope_include_sublocations: boolean; certificate_template_id: string | null;
  asset_ids: string[]; type_templates: Array<{ asset_type_id: string; checklist_template_id: string }>;
  execution_mode?: "internal" | "external"; default_provider?: string | null;
};
export type UpcomingRow = {
  asset_id: string; plan_id: string; plan_code: string; plan_name: string; frequency: string;
  interval_months: number | null; execution_mode: string; last_done_at: string | null; next_due_at: string | null;
  open_session_id: string | null;
};
export type ExternalRecord = {
  performedOn: string; provider: string; reference: string | null; result: "ok" | "with_incidents"; description: string | null;
};
export type ScopeQuery = {
  assetTypeIds: string[]; locationIds: string[]; includeSublocations: boolean; locations?: ScopeLocation[];
};
export type NewSession = {
  requestId: string; planId: string; locationId: string | null;
  scheduledFor: string | null; technicianName: string | null;
};
export type FailedResponse = { id: string; observations: string | null; prompt: string | undefined; question_id?: string | null; version_id?: string | null };
export type FailureContext = {
  session: { id: string; code: string | null };
  item: { id: string; asset_id: string };
  asset: { code: string | null; name: string | null };
};
export type TemplateInput = { [K in keyof Omit<CertificateTemplate, "id">]?: unknown };

// ---- repository capabilities ----
/** assets capability */
export interface AssetsRepository {
  listFamilies(orgId: string): Promise<{ active: boolean; code: string; color: string | null; company_id: string | null; created_at: string; id: string; is_system: boolean; name_i18n: Json; requires_certificate: boolean; sort_order: number; updated_at: string; }[]>;
  createFamily(orgId: string, v: { code: string; name: string; color: string; requires_certificate: boolean; }): Promise<void>;
  setFamilyRequiresCertificate(orgId: string, id: string, value: boolean): Promise<void>;
  deleteFamily(orgId: string, id: string): Promise<void>;
  listTypes(orgId: string): Promise<{ id: string; code: string; name_i18n: Json; category: string; is_system: boolean; family_id: string | null; }[]>;
  listTypesAdmin(orgId: string): Promise<{ active: boolean; category: string; code: string; company_id: string | null; created_at: string; family_id: string | null; id: string; is_system: boolean; metadata: Json; name_i18n: Json; updated_at: string; }[]>;
  createType(orgId: string, v: { code: string; name: string; category: string; family_id: string | null; }): Promise<void>;
  setTypeFamily(orgId: string, typeId: string, familyId: string | null): Promise<void>;
  deleteType(orgId: string, id: string): Promise<void>;
  updateFamily(orgId: string, id: string, v: { code: string; name: string; color: string; requires_certificate: boolean; }): Promise<void>;
  updateType(orgId: string, id: string, v: { code: string; name: string; category: string; family_id: string | null; }): Promise<void>;
  listCategories(orgId: string): Promise<{ id: string; code: string; name: string; }[]>;
  saveCategory(orgId: string, v: { code: string; name: string; }): Promise<void>;
  deleteCategory(orgId: string, code: string): Promise<void>;
  listActiveSites(orgId: string): Promise<{ id: string; code: string; name: string; }[]>;
  listScopeSites(orgId: string): Promise<{ id: string; name: string; code: string; parent_location_id: string | null; }[]>;
  listSites(orgId: string): Promise<{ id: string; name: string; code: string; }[]>;
  listAssets(orgId: string, f?: AssetFilters): Promise<{ id: string; code: string; name: string | null; status: string; manufacturer: string | null; model: string | null; serial_number: string | null; install_date: string | null; qr_token: string; asset_type_id: string; location_id: string | null; asset_types: { code: string; name_i18n: Json; }; locations: { name: string; code: string; } | null; }[]>;
  getAsset(orgId: string, id: string): Promise<{ asset_type_id: string; code: string; company_id: string; created_at: string; deleted_at: string | null; id: string; install_date: string | null; location_id: string | null; manufacture_date: string | null; manufacturer: string | null; metadata: Json; model: string | null; name: string | null; notes: string | null; qr_token: string; retire_date: string | null; serial_number: string | null; status: string; updated_at: string; warranty_until: string | null; asset_types: { code: string; name_i18n: Json; category: string; }; locations: { name: string; code: string; } | null; } | null>;
  createAsset(orgId: string, v: NewAsset): Promise<void>;
  updateAsset(orgId: string, id: string, v: AssetPatch): Promise<void>;
  softDeleteAsset(orgId: string, id: string): Promise<void>;
  listKitItems(orgId: string, assetId: string): Promise<{ id: string; product_code: string | null; product_name: string; quantity: number; unit: string | null; batch_code: string | null; expires_on: string | null; notes: string | null; }[]>;
  saveKitItem(orgId: string, assetId: string, id: string | null, v: KitItemInput): Promise<void>;
  insertKitItems(orgId: string, assetId: string, items: KitItemInput[]): Promise<void>;
  deleteKitItem(orgId: string, assetId: string, id: string): Promise<void>;
}

/** checklists capability */
export interface ChecklistsRepository {
  listTemplates(orgId: string): Promise<{ id: string; code: string; name: string; active: boolean; current_version: number; asset_type_id: string | null; asset_family_id: string | null; asset_type_ids: string[]; location_ids: string[]; include_sublocations: boolean; }[]>;
  getTemplate(orgId: string, id: string): Promise<{ active: boolean; asset_family_id: string | null; asset_type_id: string | null; asset_type_ids: string[]; code: string; company_id: string; created_at: string; current_version: number; deleted_at: string | null; description: string | null; id: string; include_sublocations: boolean; location_ids: string[]; name: string; updated_at: string; asset_types: { code: string; name_i18n: Json; } | null; } | null>;
  getTemplateScope(orgId: string, id: string): Promise<{ asset_family_id: string | null; asset_type_ids: string[]; location_ids: string[]; include_sublocations: boolean; } | null>;
  createTemplate(orgId: string, v: NewTemplate): Promise<string>;
  updateTemplateScope(orgId: string, id: string, v: TemplateScopeInput): Promise<void>;
  listPublishedTemplates(orgId: string): Promise<{ id: string; code: string; name: string; asset_type_id: string | null; asset_family_id: string | null; asset_type_ids: string[]; location_ids: string[]; include_sublocations: boolean; }[]>;
  listVersions(orgId: string, templateId: string): Promise<{ company_id: string | null; created_at: string; id: string; is_published: boolean; notes: string | null; published_at: string | null; published_by: string | null; template_id: string; version: number; }[]>;
  latestPublishedVersions(orgId: string, templateIds: string[]): Promise<Map<string, string>>;
  publishVersion(orgId: string, templateId: string, versionId: string, version: number): Promise<void>;
  createVersion(orgId: string, templateId: string, next: number, cloneFromVersionId: string | null): Promise<string>;
  listQuestions(orgId: string, versionId: string): Promise<{ company_id: string | null; creates_incident: boolean; fails_on: Json; help_text: string | null; id: string; metadata: Json; options: Json; position: number; prompt: string; required: boolean; response_type: string; template_version_id: string; }[]>;
  addQuestion(orgId: string, versionId: string, q: NewQuestion): Promise<void>;
  deleteQuestion(orgId: string, versionId: string, questionId: string): Promise<void>;
  listResponses(orgId: string, itemId: string): Promise<{ answer: Json; answered_at: string; answered_by: string | null; checklist_template_version_id: string | null; company_id: string | null; id: string; is_fail: boolean; maintenance_item_id: string; observations: string | null; question_id: string; }[]>;
  saveResponse(orgId: string, itemId: string, versionId: string, r: ResponseInput): Promise<void>;
}

/** plans capability */
export interface PlansRepository {
  listPlans(orgId: string): Promise<{ active: boolean; asset_family_id: string | null; asset_type_id: string | null; certificate_template_id: string | null; checklist_template_id: string | null; execution_mode: string; default_provider: string | null; code: string; company_id: string; created_at: string; deleted_at: string | null; frequency: string; id: string; interval_months: number | null; name: string; notes: string | null; scope_include_sublocations: boolean; scope_location_ids: string[]; scope_mode: string; updated_at: string; asset_types: { code: string; name_i18n: Json; } | null; asset_families: { code: string; name_i18n: Json; } | null; checklist_templates: { code: string; name: string; } | null; }[]>;
  getPlan(orgId: string, id: string): Promise<{ active: boolean; asset_family_id: string | null; asset_type_id: string | null; certificate_template_id: string | null; checklist_template_id: string | null; execution_mode: string; default_provider: string | null; code: string; company_id: string; created_at: string; deleted_at: string | null; frequency: string; id: string; interval_months: number | null; name: string; notes: string | null; scope_include_sublocations: boolean; scope_location_ids: string[]; scope_mode: string; updated_at: string; asset_types: { code: string; name_i18n: Json; } | null; asset_families: { code: string; name_i18n: Json; } | null; checklist_templates: { code: string; name: string; current_version: number; } | null; certificate_templates: { id: string; code: string; name: string; } | null; } | null>;
  listPlanAssets(orgId: string, planId: string): Promise<{ asset_id: string; company_id: string | null; created_at: string; end_on: string | null; id: string; plan_id: string; start_on: string; assets: { id: string; code: string; name: string | null; status: string; locations: { name: string; } | null; }; }[]>;
  listCertificateTemplates(orgId: string, orderBy: "code" | "name"): Promise<{ id: string; code: string; name: string; is_default: boolean; asset_family_id: string | null; }[]>;
  listScopeAssets(orgId: string, q: ScopeQuery): Promise<ScopeAsset[]>;
  createPlan(orgId: string, v: NewPlan): Promise<string>;
  setCertificateTemplate(orgId: string, planId: string, templateId: string | null): Promise<void>;
  setActive(orgId: string, planId: string, active: boolean): Promise<void>;
  addAssets(orgId: string, planId: string, assetIds: string[]): Promise<void>;
  removeAsset(orgId: string, planId: string, assignmentId: string): Promise<void>;
}

/** sessions capability */
export interface SessionsRepository {
  listSessions(orgId: string, status: string): Promise<({ closed_at: string | null; code: string; company_id: string; created_at: string; created_by: string | null; external_cert_number: string | null; external_provider: string | null; id: string; is_external: boolean; location_id: string | null; metadata: Json; notes: string | null; outcome: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; plan_id: string | null; reopen_reason: string | null; scheduled_for: string | null; signature_image_url: string | null; signer_ip: unknown; signer_name: string | null; signer_role: string | null; signer_user_agent: string | null; started_at: string | null; status: string; technician_id: string | null; technician_name: string | null; updated_at: string; maintenance_plans: { name: string; code: string; } | null; } & { history_source: HistorySource; })[]>;
  getSession(orgId: string, id: string): Promise<({ closed_at: string | null; code: string; company_id: string; created_at: string; created_by: string | null; external_cert_number: string | null; external_provider: string | null; id: string; is_external: boolean; location_id: string | null; metadata: Json; notes: string | null; outcome: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; plan_id: string | null; reopen_reason: string | null; scheduled_for: string | null; signature_image_url: string | null; signer_ip: unknown; signer_name: string | null; signer_role: string | null; signer_user_agent: string | null; started_at: string | null; status: string; technician_id: string | null; technician_name: string | null; updated_at: string; maintenance_plans: { name: string; code: string; } | null; } & { history_source: HistorySource; }) | null>;
  listItems(orgId: string, sessionId: string): Promise<({ asset_id: string; checklist_template_version_id: string | null; company_id: string | null; completed_at: string | null; completed_by: string | null; created_at: string; id: string; metadata: Json; observations: string | null; result: string; session_id: string; updated_at: string; assets: { id: string; code: string; name: string | null; manufacturer: string | null; model: string | null; location_id: string | null; locations: { name: string; } | null; asset_type_id: string; asset_types: { code: string; name_i18n: Json; }; }; } & { history_source: HistorySource; })[]>;
  listPlansForSession(orgId: string): Promise<{ id: string; code: string; name: string; checklist_template_id: string | null; asset_family_id: string | null; asset_families: { code: string; name_i18n: Json; } | null; checklist_templates: { name: string; current_version: number; } | null; }[]>;
  listPlanLocations(orgId: string, planId: string): Promise<{ id: string; name: string; }[]>;
  listAssetHistory(orgId: string, assetId: string): Promise<{ result: string; maintenance_sessions: ({ id: string; code: string; status: string; closed_at: string | null; scheduled_for: string | null; company_id: string; plan_id: string | null; metadata: Json; maintenance_plans: { name: string; } | null; } & { history_source: HistorySource; }) | null; id: string; completed_at: string | null; created_at: string; observations: string | null; }[]>;
  createSession(orgId: string, v: NewSession): Promise<string>;
  startSession(orgId: string, sessionId: string): Promise<boolean>;
  /** External/simplified sessions: stores provider, date and global result on every item, then closes. */
  recordExternal(orgId: string, sessionId: string, v: ExternalRecord): Promise<void>;
  /** One row per active plan↔asset link: last closed maintenance and next due date. */
  listUpcoming(orgId: string): Promise<UpcomingRow[]>;
  assertItemWritable(orgId: string, sessionId: string, itemId: string): Promise<{ id: string; asset_id: string; metadata: Json; }>;
  setItemResult(orgId: string, sessionId: string, itemId: string, result: string, observations: string | null, failCount: number): Promise<void>;
  closeSession(orgId: string, sessionId: string, v: { signerName: string; signerRole: string | null; signature: string; }): Promise<{ closedNow: boolean; session: { closed_at: string | null; code: string; company_id: string; created_at: string; created_by: string | null; external_cert_number: string | null; external_provider: string | null; id: string; is_external: boolean; location_id: string | null; metadata: Json; notes: string | null; outcome: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; plan_id: string | null; reopen_reason: string | null; scheduled_for: string | null; signature_image_url: string | null; signer_ip: unknown; signer_name: string | null; signer_role: string | null; signer_user_agent: string | null; started_at: string | null; status: string; technician_id: string | null; technician_name: string | null; updated_at: string; maintenance_plans: { name: string; interval_months: number | null; asset_families: { requires_certificate: boolean; } | null; } | null; }; items: { id: string; asset_id: string; result: string; observations: string | null; metadata: Json; }[]; pendingCount: number; }>;
}

/** incidents capability */
export interface IncidentsRepository {
  listIncidents(orgId: string, severity: string): Promise<{ asset_id: string | null; assigned_to: string | null; closed_at: string | null; code: string; company_id: string; created_at: string; description: string | null; due_date: string | null; id: string; location_id: string | null; metadata: Json; reporter_email: string | null; reporter_name: string | null; reporter_user_id: string | null; resolution_notes: string | null; resolved_at: string | null; severity: string; source: string; source_maintenance_item_id: string | null; source_response_id: string | null; status: string; title: string; updated_at: string; assets: { code: string; name: string | null; } | null; }[]>;
  getIncident(orgId: string, id: string): Promise<{ asset_id: string | null; assigned_to: string | null; closed_at: string | null; code: string; company_id: string; created_at: string; description: string | null; due_date: string | null; id: string; location_id: string | null; metadata: Json; reporter_email: string | null; reporter_name: string | null; reporter_user_id: string | null; resolution_notes: string | null; resolved_at: string | null; severity: string; source: string; source_maintenance_item_id: string | null; source_response_id: string | null; status: string; title: string; updated_at: string; assets: { id: string; code: string; name: string | null; } | null; locations: { id: string; name: string; } | null; }>;
  listHistory(orgId: string, id: string): Promise<{ changed_at: string; changed_by: string | null; company_id: string | null; from_status: string | null; id: string; incident_id: string; note: string | null; to_status: string; }[]>;
  listMembers(orgId: string): Promise<{ user_id: string; role: "administrator" | "system_manager" | "manager" | "employee" | "auditor"; }[]>;
  listAssetOptions(orgId: string): Promise<{ id: string; code: string; name: string | null; }[]>;
  listAssetIncidents(orgId: string, assetId: string): Promise<{ id: string; code: string; title: string; severity: string; status: string; created_at: string; }[]>;
  createManual(orgId: string, v: { title: string; description: string | null; severity: string; assetId: string | null; }): Promise<{ asset_id: string | null; assigned_to: string | null; closed_at: string | null; code: string; company_id: string; created_at: string; description: string | null; due_date: string | null; id: string; location_id: string | null; metadata: Json; reporter_email: string | null; reporter_name: string | null; reporter_user_id: string | null; resolution_notes: string | null; resolved_at: string | null; severity: string; source: string; source_maintenance_item_id: string | null; source_response_id: string | null; status: string; title: string; updated_at: string; } | null>;
  update(orgId: string, id: string, v: { title: string; description: string | null; severity: string; assignedTo: string | null; dueDate: string | null; }): Promise<void>;
  changeStatus(orgId: string, id: string, v: { from: string; to: string; note: string | null; userId: string | null; resolutionNotes?: string | undefined; }): Promise<void>;
  remove(orgId: string, id: string): Promise<void>;
  openForFailures(orgId: string, ctx: FailureContext, failed: FailedResponse[]): Promise<number>;
}

/** certificates capability */
export interface CertificatesRepository {
  resolveTemplate(orgId: string, planId: string | null): Promise<{ source: TemplateSourceKind; template: (CertificateTemplate & { id: string; }) | null; }>;
  listCertificates(orgId: string, status: string): Promise<{ code: string; company_id: string; created_at: string; created_by: string | null; deleted_at: string | null; external_cert_number: string | null; external_provider: string | null; id: string; issued_on: string; issuer_name: string | null; issuer_role: string | null; metadata: Json; notes: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; signature_image_url: string | null; signer_ip: unknown; signer_user_agent: string | null; status: string; title: string; updated_at: string; valid_until: string | null; }[]>;
  getCertificate(orgId: string, id: string): Promise<{ code: string; company_id: string; created_at: string; created_by: string | null; deleted_at: string | null; external_cert_number: string | null; external_provider: string | null; id: string; issued_on: string; issuer_name: string | null; issuer_role: string | null; metadata: Json; notes: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; signature_image_url: string | null; signer_ip: unknown; signer_user_agent: string | null; status: string; title: string; updated_at: string; valid_until: string | null; }>;
  listItems(orgId: string, certId: string): Promise<{ asset_id: string | null; certificate_id: string; company_id: string | null; created_at: string; id: string; maintenance_item_id: string | null; maintenance_session_id: string | null; notes: string | null; result: string; assets: { id: string; code: string; name: string | null; } | null; maintenance_sessions: { id: string; code: string; } | null; }[]>;
  listIncidents(orgId: string, certId: string): Promise<{ id: string; code: string; title: string; status: string; severity: string; }[]>;
  appliedTemplate(orgId: string, certId: string, snapshot: CertificateSnapshot | null): Promise<{ source: TemplateSourceKind; id: string | null; name: string; frozen: boolean; }>;
  revoke(orgId: string, certId: string): Promise<void>;
  updateNotes(orgId: string, certId: string, notes: string | null): Promise<void>;
  listAssetCertificates(orgId: string, assetId: string): Promise<{ id: string; result: string; maintenance_item_id: string | null; certificates: { id: string; code: string; title: string; issued_on: string; valid_until: string | null; status: string; company_id: string; }; }[]>;
  findSessionCertificate(orgId: string, sessionId: string): Promise<{ id: string; code: string; status: string; } | null>;
  emitForSession(orgId: string, a: { sessionId: string; sessionCode: string; planId: string | null; planName: string | null; intervalMonths: number | null; sessionMetadata: unknown; sessionLocationId: string | null; signerName: string; signerRole: string | null; signature: string; pendingCount: number; items: { id: string; asset_id: string; result: string; observations: string | null; metadata?: unknown; }[]; }): Promise<{ cert: { id: string; code: string; }; created: boolean; }>;
  loadPdfSource(orgId: string, certId: string): Promise<{ cert: { code: string; company_id: string; created_at: string; created_by: string | null; deleted_at: string | null; external_cert_number: string | null; external_provider: string | null; id: string; issued_on: string; issuer_name: string | null; issuer_role: string | null; metadata: Json; notes: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; signature_image_url: string | null; signer_ip: unknown; signer_user_agent: string | null; status: string; title: string; updated_at: string; valid_until: string | null; }; certItems: { id: string; result: string; notes: string | null; asset_id: string | null; maintenance_session_id: string | null; maintenance_item_id: string | null; assets: { code: string; name: string | null; manufacturer: string | null; model: string | null; asset_types: { code: string; name_i18n: Json; }; locations: { name: string; } | null; } | null; }[]; sessionId: string | null; session: { plan_id: string | null; status: string; metadata: unknown; maintenance_plans: { name: string } | null; locations: { name: string } | null } | null; mItems: { id: string; asset_id: string; result: string; metadata: unknown; }[]; company: { name: string; cif: string; address: string | null; logo_url: string | null; } | null; incidents: { id: string; code: string; title: string; description: string | null; status: string; severity: string; asset_id: string | null; source_maintenance_item_id: string | null; assets: { code: string; asset_types: { name_i18n: Json; code: string; }; locations: { name: string; } | null; } | null; }[]; }>;
  resolveTemplateForSession(orgId: string, planId: string | null): Promise<{ source: TemplateSourceKind; template: (CertificateTemplate & { id: string; }) | null; }>;
  readFrozenLogo(orgId: string, path: string): Promise<{ bytes: Uint8Array; contentType: string; } | null>;
  sha256Hex(bytes: Uint8Array): Promise<string>;
  signedLogoUrl(path: string, seconds?: number): Promise<string>;
  storePdf(orgId: string, certId: string, bytes: Uint8Array, hashHex: string): Promise<{ pdfUrl: string; created: boolean; }>;
  pdfDownloadUrl(orgId: string, certId: string): Promise<string>;
  listTemplates(orgId: string): Promise<{ id: string; code: string; name: string; language: string; is_default: boolean; updated_at: string; }[]>;
  getTemplate(orgId: string, id: string): Promise<{ asset_family_id: string | null; code: string; columns: Json; company_id: string; created_at: string; deleted_at: string | null; footer_text: string; id: string; intro_text: string; is_default: boolean; language: string; logo_url: string | null; name: string; notes: string | null; paper_size: string; regulation_text: string; show_company_stamp: boolean; show_logo: boolean; show_signature: boolean; title: string; updated_at: string; }>;
  createTemplate(orgId: string, t: TemplateInput): Promise<string>;
  updateTemplate(orgId: string, id: string, patch: TemplateInput): Promise<void>;
  softDeleteTemplate(orgId: string, id: string): Promise<void>;
  uploadTemplateLogo(orgId: string, templateId: string, file: BinaryUpload): Promise<string>;
  listAssetsForExternal(orgId: string): Promise<{ id: string; code: string; name: string | null; }[]>;
  registerExternal(orgId: string, v: { title: string; issuedOn: string; validUntil: string | null; issuerName: string | null; issuerRole: string | null; provider: string; externalNumber: string | null; notes: string | null; assetId: string | null; file: BinaryUpload; }): Promise<{ code: string; company_id: string; created_at: string; created_by: string | null; deleted_at: string | null; external_cert_number: string | null; external_provider: string | null; id: string; issued_on: string; issuer_name: string | null; issuer_role: string | null; metadata: Json; notes: string | null; pdf_hash_sha256: string | null; pdf_url: string | null; signature_image_url: string | null; signer_ip: unknown; signer_user_agent: string | null; status: string; title: string; updated_at: string; valid_until: string | null; }>;
}

/** Complete data capability set a host must provide. */
export interface MaintenanceRepositories {
  assets: AssetsRepository;
  checklists: ChecklistsRepository;
  plans: PlansRepository;
  sessions: SessionsRepository;
  incidents: IncidentsRepository;
  certificates: CertificatesRepository;
  /** Metrology submodule (optional until the ICORE package includes it). Contract: ./metrology.ts */
  metrology?: import("./metrology").MetrologyContract;
}
