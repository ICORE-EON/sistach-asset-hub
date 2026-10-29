# Contratos que debe implementar ICORE

Dos niveles: **SQL** (autoridad, lo usa `install_v1.sql`) y **TypeScript** (puertos de `contracts/index.ts`, solo UX/datos auxiliares).
Las fuentes de verdad previstas y sus nombres se documentan en INTEGRATION_HANDOFF.md; no se ha inspeccionado su esquema ni se implementan consultas reales. Las firmas SQL de este documento son el contrato requerido, no tablas nuevas del host.

## 1. Organizaciones
- SQL: ICORE llama `public.mnt_register_org(org uuid)` (service_role) al dar de alta la organización en el módulo. `org_id` = identificador canónico de organización de ICORE.
- TS: `TenantPort.currentOrgId()` para la UI; los servicios siempre reciben `orgId` explícito.
- Pendiente ICORE: alta/baja, y purga acordada (el historial inmutable impide borrado en cascada).

## 2. Identidad y personas
- SQL: `auth.uid()` y `public.host_person_ref() → uuid` (persona canónica); `public.host_person_snapshot(uuid) → jsonb {name, role, external, provider}`. Sin FK a tablas de usuarios.
- TS: `PeoplePort.current/search/get` → `PersonRef`. Los snapshots (`ActorSnapshot`) se congelan en cierres, historial, firmas y certificados; nunca se recalculan.

## 3. Permisos
- SQL: `public.host_has_perm(org uuid, perm text) → boolean`; SECURITY DEFINER, `search_path` fijo, deriva de `auth.uid()`, **false** sin sesión o ante error, EXECUTE solo a `authenticated`.
- Permisos: `mnt.view, mnt.manage_assets, mnt.run, mnt.close, mnt.reopen, mnt.certify, mnt.admin`.
- TS: `AuthzPort.can()` solo oculta/deshabilita botones. La decisión real la toman RLS y RPC.

## 4. Centros
- SQL: `public.host_site_in_org(org uuid, site uuid) → boolean` (valida cada `site_ref`).
- TS: `SitePort.tree(orgId)` (jerarquía `id, name, code, parentId`) y `expand(ids, withChildren)`.

## 5. Documentos y versiones
- SQL: `public.host_document_version_sha(org uuid, ref uuid) → text`. `mnt_attach_certificate_pdf` exige que el SHA-256 coincida.
- TS: `DocumentPort.registerVersion({orgId, kind, subject, bytesRef, mime, meta}) → {documentId, versionId, sha256}` y `signedUrl(ref)`. Sin `File`/`Blob`: bytes referenciados; el hash lo calcula el servidor.

## 6. Almacenamiento de PDF y logos
- El PDF lo genera `render/certificate-pdf.ts` (pdf-lib, portable) o un servicio de ICORE; se guarda en el sistema documental de ICORE y se enlaza con `document_version_ref`.
- Logos de plantilla: `readFrozenLogo`, `signedLogoUrl`, `uploadTemplateLogo` delegan en el almacenamiento del host (`BinaryUpload` con `Uint8Array`).

## 7. Auditoría: consumo de `mnt_outbox`
- Cada RPC escribe el cambio y el evento en la misma transacción. Tipos: ver `MntDomainEvent` en `contracts/index.ts`.
- ICORE lee con `service_role` en orden de `created_at`, procesa de forma idempotente por `event_id` y marca `processed_at`. Reintentos: al menos una vez.
- Pendiente ICORE: transporte (cola, cron, trigger), retención y panel de auditoría.

## Metrología (`install_metrology_v1.sql`)
Reutiliza los contratos SQL existentes; no añade ninguno nuevo:
- `host_person_ref()` — autor de altas, validaciones, decisiones, cierres de impacto y movimientos (sustituye `auth.uid()`).
- `host_person_snapshot(uuid)` vía `mnt_actor_snapshot()` — instantánea de firmante (sustituye la lectura de `profiles`).
- `host_site_in_org(org, site)` — obligatorio en alta/edición/traslado de equipos (sustituye `locations`); NULL/false ⇒ rechazo 23514.
- `host_document_version_sha(org, ref)` — `document_ref` de un registro debe resolver dentro de la org al validar; NULL ⇒ rechazo 23514 (fail-closed).
- `host_has_perm(org, perm)` vía `mnt_can`: `mnt.view`, `mnt.manage_assets` (equipos/planes/traslado/estado), `mnt.run` (borradores y líneas), `mnt.close` (validar, rectificar, decidir No apto, cerrar impacto).
TypeScript: contrato de 24 operaciones y stub de rechazo explícito exportados; adaptador REAL iCore de `MetrologyContract` sigue **sin implementar**.


### Metrología Fase 2
No requiere nuevos contratos de host: el vínculo usa `mnt_assets` del propio paquete. La ubicación mostrada para equipos vinculados procede del activo (`site_ref`, resuelto por el host).

### Asociación operativa (corrección 2026-10-29)
`parent_asset_id` es una relación N:1 separada de `asset_id` (identidad 1:1). FK compuesta a `mnt_assets`, sin cascada. `mnt_mtr_associate_equipment(org,parent,ids[])` usa permisos `mnt.manage_assets` + RLS, bloqueo ordenado, lote atómico e idempotente; rechaza reasignaciones y tenants ajenos. `getInventoryAsset` debe leer un activo vigente solo de la org. El host documental `RecordDocument` con `disabled=true` permite abrir el certificado, nunca subir/quitar. Adaptador real ICORE continúa pendiente.

## Fuentes de verdad y recolocación
Ver INTEGRATION_HANDOFF.md: organizaciones `organizations`; centros `org_sites`; personas/puestos `people`, `positions`, `position_assignments`; documentación `documents`, `document_versions`; acciones `management_actions`; estructura `mgmt_families`, `mgmt_element_catalog`, `mgmt_elements`, `mgmt_components`; planificación `mgmt_plans`, `mgmt_plan_status`, `mgmt_reviews`. Normativa: enlaces estructurados del catálogo, no texto libre como autoridad. Estos nombres describen intención; no son consultas ni un esquema verificado.

No crear réplicas de estas autoridades. `mnt_orgs` registra referencias/ajustes técnicos del módulo, no sustituye organizations. Las tablas mnt de catálogos/planes son el almacenamiento operativo del instalador de referencia; el destino debe acordar su correspondencia/proyección con el sistema canónico antes de activar, no instalar una autoridad paralela a ciegas. No hay ese mapeo real en esta entrega.

## Flujo QR operativo autenticado (2026-10-29)
- **Implementado y exportado:** contrato `contracts/scan.ts` (`ScanContract`, 8 operaciones `scan.*`), servicio `services/scan.ts`, UI portable sin router (`ui/pages/SessionRunPage.tsx`, `ui/components/{qr-scanner,session-execution,item-checklist}.tsx`), SQL en `sql/install_v1.sql`: tablas `mnt_session_assignees`, `mnt_item_execution_keys`, `mnt_session_item_exceptions`, `mnt_session_closure_events`, `mnt_qr_token_events`; resultado `excepted`; funciones `mnt_can_execute_session`, `mnt_resolve_scan`, `mnt_list_my_runnable_sessions`, `mnt_record_item_execution`, `mnt_record_closure_exception`, `mnt_assign_session_people`, `mnt_regenerate_asset_qr`; `mnt_close_session` registra historial de cierre.
- **Reglas:** el QR solo se resuelve con sesión iniciada, misma organización, `mnt.run` y asignación a la sesión (asignado, técnico de la sesión o responsable con `mnt.close`); cualquier otro caso devuelve `{status:"not_available"}`. Ejecución idempotente por clave. Excepciones solo con `mnt.close`, motivo obligatorio, inmutables y nunca cuentan como revisado. Cierre bloqueado con pendientes. Regenerar QR exige `mnt.admin`, invalida al instante y guarda solo el SHA-256 del token anterior. Anomalía → evento outbox `mnt.session.item_anomaly` (iCore decide si crea management_actions).
- **Probado:** 36 comprobaciones SQL `qr:` en PostgreSQL temporal (`sql/__tests__/fixtures/scan_tests.sql`), pruebas de contrato `contracts/__tests__/scan-contract.test.ts`.
- **Excluido:** el antiguo endpoint público `/api/public/qr/$token` (eliminado), las rutas wrapper del standalone (`src/routes/_authenticated/_app.{run.index,run.$id,qr.$token}.tsx`) y su autenticación.
- **Pendiente en iCore (stub fail-closed):** adaptador real de `ScanContract`; wrappers autenticados propios (`/qr/:token`, ejecutar sesión) sobre `SessionRunPage` pasando `nav`; mapear `person_ref` a people/positions y `mnt.run/close/admin`; evidencias en documents/document_versions; consumidor de `mnt.session.item_anomaly`. `listSessionPeople` depende del PeoplePort del host.
