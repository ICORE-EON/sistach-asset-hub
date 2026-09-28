# Especificación del adaptador ICORE — 94 operaciones

Firmas: `contracts/repositories.ts`. Metadatos: `contracts/operations.ts` (sincronizados por prueba).
Se mencionaban 90; el recuento exacto del contrato actual es **94** (2 de ellas son utilidades sin organización: `sha256Hex`, `signedLogoUrl`).

Tipo: **read** lectura bajo RLS · **write** escritura directa bajo RLS/triggers · **atomic** una RPC o transacción única · **host** resuelta por un puerto del host.

## Contexto y errores comunes
- `orgId` explícito como primer argumento; identidad derivada de la sesión del host (`auth.uid()` → `host_person_ref()`), nunca de un parámetro de la UI. `userId`, cuando aparece, es informativo.
- Sin `orgId` los servicios fallan antes de llegar al adaptador.
- Errores (SQLSTATE de install_v1.sql); el adaptador los propaga sin reinterpretar:

| SQLSTATE | Significado | Tratamiento |
|---|---|---|
| 42501 | sin permiso, sin sesión u otra organización | propagar |
| 55000 | el estado no lo permite (sesión cerrada, versión publicada, historial inmutable, transición inválida) | propagar el mensaje de la base |
| 23514 | regla de negocio/CHECK (centro ajeno, SHA no coincide) | propagar |
| 23503 | referencia a entidad de otra organización o inexistente | propagar |
| 23505 | duplicado | propagar (createSession con el mismo request_id devuelve la misma sesión) |
| P0002 | no encontrado en RPC | `get*` devuelve `null`; escrituras propagan |
| 40001 | conflicto de concurrencia | reintentar una vez o propagar |
| MNT_ICORE_NOT_CONFIGURED | esqueleto sin implementar | nunca en producción |

**Regla de autoridad:** las transiciones y estados los decide PostgreSQL. Las comprobaciones de `domain/*-rules.ts` son solo UX. Una operación **atomic** debe llamar a la RPC y devolver lo que la base decida; está prohibido calcular estado/outcome en TypeScript y escribirlo directamente.

## Activos, familias, tipos y botiquines (`assets`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `listFamilies` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_asset_families (globales + org) | — |
| `createFamily` | `orgId: string, v: { code: string; name: string; color: string; requires_certificate: boolean; }` | `void` | write | mnt.admin | RLS mnt_asset_families | — |
| `setFamilyRequiresCertificate` | `orgId: string, id: string, value: boolean` | `void` | write | mnt.admin | RLS mnt_asset_families (is_system inmutable) | — |
| `deleteFamily` | `orgId: string, id: string` | `void` | write | mnt.admin | RLS; FK compuesta impide borrar familias en uso | — |
| `listTypes` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS + mnt_org_asset_types (solo activados) | — |
| `listTypesAdmin` | `orgId: string` | `DTO (ver contrato)` | read | mnt.admin | RLS mnt_asset_types + activación | — |
| `createType` | `orgId: string, v: { code: string; name: string; category: string; family_id: string \| null; }` | `void` | write | mnt.admin | RLS mnt_asset_types | — |
| `setTypeFamily` | `orgId: string, typeId: string, familyId: string \| null` | `void` | write | mnt.admin | RLS mnt_asset_types | — |
| `deleteType` | `orgId: string, id: string` | `void` | write | mnt.admin | RLS; FK compuesta | — |
| `listActiveSites` | `orgId: string` | `{ id: string; code: string; name: string; }[]` | host | mnt.view | SitePort.tree del host | sites |
| `listScopeSites` | `orgId: string` | `DTO (ver contrato)` | host | mnt.view | SitePort.tree del host (jerarquía) | sites |
| `listSites` | `orgId: string` | `{ id: string; name: string; code: string; }[]` | host | mnt.view | SitePort.tree del host | sites |
| `listAssets` | `orgId: string, f?: AssetFilters` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_assets | sites |
| `getAsset` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_assets | sites |
| `createAsset` | `orgId: string, v: NewAsset` | `void` | write | mnt.manage_assets | RLS + triggers mnt_tg_site_scope / mnt_type_usable + código mnt_next_code | sites |
| `updateAsset` | `orgId: string, id: string, v: AssetPatch` | `void` | write | mnt.manage_assets | RLS + trigger mnt_tg_site_scope | sites |
| `softDeleteAsset` | `orgId: string, id: string` | `void` | write | mnt.manage_assets | RLS mnt_assets (deleted_at) | — |
| `listKitItems` | `orgId: string, assetId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_kit_items | — |
| `saveKitItem` | `orgId: string, assetId: string, id: string \| null, v: KitItemInput` | `void` | write | mnt.manage_assets | RLS mnt_kit_items (FK compuesta org,asset) | — |
| `insertKitItems` | `orgId: string, assetId: string, items: KitItemInput[]` | `void` | write | mnt.manage_assets | RLS mnt_kit_items | — |
| `deleteKitItem` | `orgId: string, assetId: string, id: string` | `void` | write | mnt.manage_assets | RLS mnt_kit_items | — |

## Checklists (`checklists`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `listTemplates` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_checklist_templates + puentes _types/_sites | — |
| `getTemplate` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_checklist_templates | — |
| `getTemplateScope` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS puentes _types/_sites | — |
| `createTemplate` | `orgId: string, v: NewTemplate` | `string` | write | mnt.admin | RLS + puentes (FK compuestas) | sites |
| `updateTemplateScope` | `orgId: string, id: string, v: TemplateScopeInput` | `void` | write | mnt.admin | RLS puentes; sustitución en una transacción | sites |
| `listPublishedTemplates` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_checklist_versions (publicadas) | — |
| `listVersions` | `orgId: string, templateId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_checklist_versions | — |
| `latestPublishedVersions` | `orgId: string, templateIds: string[]` | `Map<string, string>` | read | mnt.view | RLS mnt_checklist_versions | — |
| `publishVersion` | `orgId: string, templateId: string, versionId: string, version: number` | `void` | atomic | mnt.admin | RPC mnt_publish_checklist_version | — |
| `createVersion` | `orgId: string, templateId: string, next: number, cloneFromVersionId: string \| null` | `string` | write | mnt.admin | RLS; clonado de preguntas en la misma transacción | — |
| `listQuestions` | `orgId: string, versionId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_checklist_questions | — |
| `addQuestion` | `orgId: string, versionId: string, q: NewQuestion` | `void` | write | mnt.admin | RLS + mnt_tg_checklist_guard (versión publicada inmutable) | — |
| `deleteQuestion` | `orgId: string, versionId: string, questionId: string` | `void` | write | mnt.admin | RLS + mnt_tg_checklist_guard | — |
| `listResponses` | `orgId: string, itemId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_responses | — |
| `saveResponse` | `orgId: string, itemId: string, versionId: string, r: ResponseInput` | `void` | write | mnt.run | RLS + mnt_tg_item_guard (sesión abierta) | people |

## Planes (`plans`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `listPlans` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_plans | — |
| `getPlan` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_plans | — |
| `listPlanAssets` | `orgId: string, planId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_plan_assets | — |
| `listCertificateTemplates` | `orgId: string, orderBy: "code" \| "name"` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_templates | — |
| `listScopeAssets` | `orgId: string, q: ScopeQuery` | `ScopeAsset[]` | read | mnt.view | RLS mnt_assets + expansión de centros | sites |
| `createPlan` | `orgId: string, v: NewPlan` | `string` | write | mnt.admin | RLS + puentes mnt_plan_sites/_assets/_type_templates | sites |
| `setCertificateTemplate` | `orgId: string, planId: string, templateId: string \| null` | `void` | write | mnt.admin | RLS mnt_plans (FK compuesta) | — |
| `setActive` | `orgId: string, planId: string, active: boolean` | `void` | write | mnt.admin | RLS mnt_plans | — |
| `addAssets` | `orgId: string, planId: string, assetIds: string[]` | `void` | write | mnt.admin | RLS mnt_plan_assets (FK compuesta) | — |
| `removeAsset` | `orgId: string, planId: string, assignmentId: string` | `void` | write | mnt.admin | RLS mnt_plan_assets | — |

## Sesiones (`sessions`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `listSessions` | `orgId: string, status: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_sessions | — |
| `getSession` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_sessions | people |
| `listItems` | `orgId: string, sessionId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_session_items | — |
| `listPlansForSession` | `orgId: string` | `DTO (ver contrato)` | read | mnt.run | RLS mnt_plans | — |
| `listPlanLocations` | `orgId: string, planId: string` | `{ id: string; name: string; }[]` | read | mnt.run | RLS mnt_plan_sites + SitePort | sites |
| `listAssetHistory` | `orgId: string, assetId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_session_items / mnt_session_history | — |
| `createSession` | `orgId: string, v: NewSession` | `string` | atomic | mnt.run | RPC mnt_create_session (idempotente por request_id) | sites, people |
| `startSession` | `orgId: string, sessionId: string` | `boolean` | write | mnt.run | RLS + mnt_tg_session_guard (draft→in_progress) | — |
| `assertItemWritable` | `orgId: string, sessionId: string, itemId: string` | `{ id: string; asset_id: string; metadata: Json; }` | read | mnt.run | Solo UX: la autoridad es mnt_tg_item_guard | — |
| `setItemResult` | `orgId: string, sessionId: string, itemId: string, result: string, observations: string \| null, failCount: number` | `void` | write | mnt.run | RLS + mnt_tg_item_guard | people |
| `closeSession` | `orgId: string, sessionId: string, v: { signerName: string; signerRole: string \| null; signature: string; }` | `DTO (ver contrato)` | atomic | mnt.close | RPC mnt_close_session (snapshot + historial + outbox) | people |

## Incidencias (`incidents`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `listIncidents` | `orgId: string, severity: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_incidents | — |
| `getIncident` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_incidents | people |
| `listHistory` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_incident_history (append-only) | people |
| `listMembers` | `orgId: string` | `DTO (ver contrato)` | host | mnt.view | PeoplePort.search del host | people |
| `listAssetOptions` | `orgId: string` | `{ id: string; code: string; name: string \| null; }[]` | read | mnt.view | RLS mnt_assets | — |
| `listAssetIncidents` | `orgId: string, assetId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_incidents | — |
| `createManual` | `orgId: string, v: { title: string; description: string \| null; severity: string; assetId: string \| null; }` | `DTO (ver contrato)` | atomic | mnt.run | RPC mnt_open_incident | people |
| `update` | `orgId: string, id: string, v: { title: string; description: string \| null; severity: string; assignedTo: string \| null; dueDate: string \| null; }` | `void` | write | mnt.run | RLS mnt_incidents (el estado no cambia aquí) | people |
| `changeStatus` | `orgId: string, id: string, v: { from: string; to: string; note: string \| null; userId: string \| null; resolutionNotes?: string \| undefined; }` | `void` | atomic | mnt.run | RPC mnt_change_incident_status (transiciones en PostgreSQL) | people |
| `remove` | `orgId: string, id: string` | `void` | write | mnt.admin | RLS; solo sin historial (inmutabilidad) | — |
| `openForFailures` | `orgId: string, ctx: FailureContext, failed: FailedResponse[]` | `number` | atomic | mnt.run | RPC mnt_open_incident por fallo (o dentro de mnt_close_session) | people |

## Certificados (`certificates`)

| Operación | Entradas | Salida | Tipo | Permiso | Autoridad | Puertos |
|---|---|---|---|---|---|---|
| `resolveTemplate` | `orgId: string, planId: string \| null` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_templates | — |
| `listCertificates` | `orgId: string, status: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificates | — |
| `getCertificate` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificates | — |
| `listItems` | `orgId: string, certId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_items | — |
| `listIncidents` | `orgId: string, certId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_incidents | — |
| `appliedTemplate` | `orgId: string, certId: string, snapshot: CertificateSnapshot \| null` | `DTO (ver contrato)` | read | mnt.view | Snapshot congelado en el certificado | — |
| `revoke` | `orgId: string, certId: string` | `void` | atomic | mnt.certify | RPC mnt_revoke_certificate | — |
| `updateNotes` | `orgId: string, certId: string, notes: string \| null` | `void` | write | mnt.certify | RLS + mnt_tg_certificate_guard (solo notas) | — |
| `listAssetCertificates` | `orgId: string, assetId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_items | — |
| `findSessionCertificate` | `orgId: string, sessionId: string` | `{ id: string; code: string; status: string; } \| null` | read | mnt.view | RLS mnt_certificates | — |
| `emitForSession` | `orgId: string, a: { sessionId: string; sessionCode: string; planId: string \| null; planName: string \| null; intervalMonths: number \| null; sessionMetadata: unknown; sessionLocationId: string \| null; signerName: string; signerRole: string \| null; signature: string; pendingCount: number; items: { id: string; asset_id: string; result: string; observations: string \| null; metadata?: unknown; }[]; }` | `{ cert: { id: string; code: string; }; created: boolean; }` | atomic | mnt.certify | Transacción única (certificado + ítems + outbox); PDF después | people |
| `loadPdfSource` | `orgId: string, certId: string` | `DTO (ver contrato)` | read | mnt.certify | RLS; datos congelados del certificado | — |
| `resolveTemplateForSession` | `orgId: string, planId: string \| null` | `DTO (ver contrato)` | read | mnt.certify | RLS mnt_certificate_templates | — |
| `readFrozenLogo` | `orgId: string, path: string` | `{ bytes: Uint8Array; contentType: string; } \| null` | host | mnt.certify | Almacenamiento del host (lectura de bytes) | storage |
| `sha256Hex` | `bytes: Uint8Array` | `string` | host | — | Utilidad pura; el hash de autoridad lo recalcula el servidor | — |
| `signedLogoUrl` | `path: string, seconds?: number` | `string` | host | mnt.view | Almacenamiento del host (URL firmada) | storage |
| `storePdf` | `orgId: string, certId: string, bytes: Uint8Array, hashHex: string` | `{ pdfUrl: string; created: boolean; }` | atomic | mnt.certify | DocumentPort.registerVersion + RPC mnt_attach_certificate_pdf (SHA debe coincidir) | documents, storage |
| `pdfDownloadUrl` | `orgId: string, certId: string` | `string` | host | mnt.view | DocumentPort.signedUrl | documents |
| `listTemplates` | `orgId: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_templates | — |
| `getTemplate` | `orgId: string, id: string` | `DTO (ver contrato)` | read | mnt.view | RLS mnt_certificate_templates | — |
| `createTemplate` | `orgId: string, t: TemplateInput` | `string` | write | mnt.admin | RLS mnt_certificate_templates | — |
| `updateTemplate` | `orgId: string, id: string, patch: TemplateInput` | `void` | write | mnt.admin | RLS mnt_certificate_templates | — |
| `softDeleteTemplate` | `orgId: string, id: string` | `void` | write | mnt.admin | RLS mnt_certificate_templates | — |
| `uploadTemplateLogo` | `orgId: string, templateId: string, file: BinaryUpload` | `string` | host | mnt.admin | Almacenamiento del host (bytes Uint8Array) | storage |
| `listAssetsForExternal` | `orgId: string` | `{ id: string; code: string; name: string \| null; }[]` | read | mnt.certify | RLS mnt_assets | — |
| `registerExternal` | `orgId: string, v: { title: string; issuedOn: string; validUntil: string \| null; issuerName: string \| null; issuerRole: string \| null; provider: string; externalNumber: string \| null; notes: string \| null; assetId: string \| null; file: BinaryUpload; }` | `DTO (ver contrato)` | atomic | mnt.certify | RPC mnt_register_external_certificate | documents, people |
