# Auditoría técnica y plan de desacoplamiento del módulo de mantenimiento (ICORE)

Solo auditoría y propuesta. No se implementa, no se migran datos, no se publica ni se conecta GitHub hasta aprobación explícita.

## A) Diagnóstico con hallazgos priorizados

**P0 – Bloqueantes de portabilidad y seguridad**
1. Acceso a datos disperso: 25 ficheros llaman directamente a `supabase.from/rpc/storage` (dashboard 12, settings 10, maintenance.$id 5, attachments-panel 5, certificate-generator 4…). No existe capa de repositorio, así que la lógica de negocio está dentro de las páginas.
2. Tenant elegido en `localStorage` (`active_company_id`, en CompanyContext). La base de datos filtra por pertenencia (`user_company_ids()`/`can_view`), pero el frontend confía en esa clave para filtrar. Si un usuario pertenece a varias empresas, un error de filtro en una página mezcla datos de distintas empresas sin que la base de datos lo impida (la base de datos solo impide acceder a empresas ajenas).
3. El endpoint público del QR (`/api/public/qr.$token`) usa el cliente con privilegios totales y devuelve empresa, ubicación, última revisión e incidencias abiertas a cualquiera que tenga el token. No hay caducidad, rotación ni límite de peticiones.
4. Hay claves foráneas directas a `auth.users` en `maintenance_sessions` (technician_id, created_by), `maintenance_items.completed_by`, `checklist_responses.answered_by`, `checklist_template_versions.published_by`, `incidents` (assigned_to, reporter_user_id), `incident_status_history`, `session_reopen_log` y `company_invitations`. En ICORE no son portables.
5. Ámbitos guardados como arrays de UUID sin clave foránea: `checklist_templates.asset_type_ids` y `location_ids`, y `maintenance_plans.scope_location_ids`. No hay integridad referencial y la RLS no puede validar cada elemento.

**P1 – Deuda de modelo**
6. Clasificación duplicada: `asset_types.category` (con CHECK de valores fijos) convive con `asset_families`/`family_id`. La migración 20260906073220 deriva la familia a partir de `category`, así que hay dos fuentes de verdad.
7. Tres campos para lo mismo: `checklist_templates.asset_type_id` (legado), `asset_family_id` y `asset_type_ids`. Lo mismo en `maintenance_plans`: `asset_type_id`, `asset_family_id`, `checklist_template_id` y `maintenance_plan_type_templates`.
8. Los estados están repartidos y no coinciden entre sí: `maintenance_items.result` (ok/fail/with_incident/na/pending/skipped), `certificate_items.result` (ok/conditional/failed/na), `maintenance_sessions.status` + `outcome`, e `incidents.status`. El frontend tiene que traducir de uno a otro (ya dio errores de CHECK).
9. `certificates` y `maintenance_sessions` repiten firma, `pdf_url`, hash e IP. No está claro cuál de las dos tablas es la fuente de verdad.
10. `documents` es un repositorio general con 7 claves foráneas opcionales (asset, location, vehicle, session, item, incident, certificate). Es infraestructura común, no parte del módulo.

**P2 – Migraciones**
11. 20260907192726 y 20260907192916 no son idénticas, pero sí redundantes: las dos añaden las mismas columnas a `checklist_templates`, hacen el mismo cálculo inicial de datos con distinta condición y crean los mismos índices con `IF NOT EXISTS`. La segunda no tiene efecto sobre la primera. No son contradictorias, pero son deuda.
12. Hay 21 migraciones incrementales con parches encadenados (constraints eliminadas y recreadas, triggers corregidos más tarde). Una instalación nueva no debería repetir ese historial.
13. Hay 9 migraciones con `SECURITY DEFINER`. Hay que verificar una por una que todas fijan `search_path` y que han revocado `EXECUTE` a `PUBLIC/anon` (en la primera migración se hizo solo para algunas).
14. Las tablas de auditoría están particionadas por mes. Las particiones de 2026_08 a 2026_12 no tienen políticas (quedan cerradas por defecto, lo cual es correcto) y dependen de `audit_logs_ensure_partitions`. Todo esto es infraestructura común.

**P3 – Acoplamiento de interfaz**
15. Las páginas dependen de `useCompany()`/`useAuth()`, de la barra lateral, de la barra superior, de la campana de notificaciones y de rutas `/_authenticated/_app.*`.
16. La generación de PDF (`pdf-lib` + fontkit) funciona en el navegador y es portable. Sin embargo, el hash y la firma se calculan en el cliente, así que no son una prueba de confianza.

## B) Inventario

| Elemento | Decisión |
|---|---|
| assets, asset_families, asset_types, vehicles, vehicle_mounts, first_aid_kit_contents | Exportar (dominio) |
| maintenance_plans, plan_assets, plan_type_templates, sessions, items, reopen_log | Exportar |
| checklist_templates, versions, questions, responses | Exportar |
| incidents, incident_status_history | Exportar (estados propios) |
| certificate_templates, certificates, certificate_items | Exportar la lógica; el PDF y los archivos van al sistema documental de ICORE |
| next_code / counters | Reescribir con alcance del módulo (`mnt_counters`) |
| lib: checklist-scope, maintenance-scope (partes puras), cert-status, certificate-templates/*, certificate-pdf, import/parse | Exportar a la capa de dominio o servicios |
| companies, company_members, company_invitations, company_features, profiles, has_role_in/can_* | Descartar; se sustituyen por adaptadores |
| locations | Descartar; se usa el adaptador de centros de ICORE |
| documents, buckets documents/asset-photos/signed-certificates/company-logos | Descartar; se usa el adaptador documental |
| audit_logs*, audit_outbox, audit_trigger_fn | Descartar; se emiten eventos mediante el adaptador |
| notification_* | Descartar; el módulo solo emite eventos de dominio |
| import_batches/rows/errors | Reescribir: el parser se conserva y los lotes pasan al motor de importación de ICORE, si lo tiene |
| Shell, sidebar, topbar, login, signup, onboarding, select-company, settings, dashboard | Descartar |
| Página QR pública | Reescribir detrás del contrato de ICORE (token firmado y con caducidad) |

## C) Arquitectura objetivo

```text
src/modules/maintenance/
  index.ts                 API pública del módulo (rutas, providers, tipos)
  contracts/               Interfaces de adaptadores (TenantPort, LocationPort,
                           PeoplePort, DocumentPort, AuditPort, AuthzPort)
  domain/                  Tipos, estados, reglas puras (scope, resolución de
                           plantillas, resultado de sesión, mapeos de estados)
  data/                    Repositorios (único sitio con supabase.*), mappers
  services/                Casos de uso: createPlan, openSession, answerChecklist,
                           closeSession, reopenSession, issueCertificate, raiseIncident
  ui/                      Páginas y componentes actuales, movidos sin cambio visual
  adapters/standalone/     Implementación actual (companies, locations, profiles,
                           documents, audit) para seguir funcionando aquí
  adapters/icore/          Stub con el contrato; se implementa en ICORE
```

Regla: `ui` solo usa `services`; `services` solo usa `data` y `contracts`; `domain` no tiene dependencias. Una regla de lint (import boundaries) impide que `ui` o `services` importen `@/integrations/supabase`.

## D) Mapa de datos actual → ICORE

| Actual | Objetivo |
|---|---|
| company_id (FK companies) | `org_id uuid`, sin FK local; lo valida TenantPort y la RLS mediante la función de membresía de ICORE |
| locations / location_id | `site_ref uuid` → centro/ubicación de ICORE (LocationPort); el árbol lo resuelve el adaptador |
| auth.users (technician_id, completed_by, answered_by, assigned_to…) | `person_ref uuid` → persona de ICORE (PeoplePort); nombre desnormalizado solo como instantánea en firma o certificado |
| company_members.role / can_* | AuthzPort con permisos del módulo: `mnt.view, mnt.manage_assets, mnt.run, mnt.close, mnt.reopen, mnt.admin` |
| documents / buckets | `evidence_ref` → documento/versión de ICORE (DocumentPort) |
| certificates.pdf_url + hash | `document_version_ref` + hash calculado en servidor |
| audit_logs / triggers | AuditPort con eventos de dominio (`mnt.session.closed`, `mnt.incident.opened`…) |
| notification_events | Eventos de dominio que ICORE consume |
| checklist_templates.asset_type_ids[] | `mnt_checklist_template_types(template_id, asset_type_id)` PK compuesta, FKs, índice |
| checklist_templates.location_ids[] | `mnt_checklist_template_sites(template_id, site_ref, include_children)` |
| maintenance_plans.scope_location_ids[] | `mnt_plan_sites(plan_id, site_ref, include_children)` |
| asset_types.category | Se elimina tras migrar a `family_id NOT NULL`; si hace falta un comportamiento especial (vehículo, botiquín), se usa `asset_families.kind` controlado |
| asset_type_id legado en plantillas y planes | Se elimina; el ámbito queda solo en las tablas de relación |

Estados propios del dominio (un solo enum por concepto y un mapeo explícito en `domain/`):
- plan: `active | paused | archived`
- session: `draft | in_progress | closed | reopened | cancelled` + outcome `ok | with_incidents | partial | not_performed`
- item: `pending | ok | failed | not_applicable | skipped`
- incident: `open | in_progress | resolved | closed | cancelled`
- certificate_item: se deriva del estado del ítem, no se guarda por separado

Estados compartidos que se delegan en ICORE: documentos (vigencia, versiones) y notificaciones (entrega).

## E) Plan por fases (commits pequeños)

**Fase 0 – Red de seguridad**: pruebas de dominio con vitest para checklist-scope, maintenance-scope, cálculo del resultado de sesión y mapeo de estados; test de aislamiento RLS entre dos empresas.

**Fase 1 – Frontera y contratos** (sin cambios de comportamiento): crear `src/modules/maintenance/{contracts,domain}`, mover allí las funciones puras de `src/lib/*` dejando reexports y definir los puertos.

**Fase 2 – Adaptadores standalone**: TenantPort (sobre CompanyContext), LocationPort (locations), PeoplePort (profiles), DocumentPort (documents + storage), AuditPort (no-op, porque los triggers actuales siguen), AuthzPort (can_*).

**Fase 3 – Repositorios y servicios**, uno por dominio y un commit cada uno: assets/familias/tipos → checklist → planes → sesiones (maintenance.$id) → incidencias → certificados. Se eliminan las llamadas `supabase.*` de las páginas del módulo.

**Fase 4 – Mover la interfaz** a `modules/maintenance/ui`; las rutas `_app.*.tsx` quedan como envoltorios de una línea. Sin cambios visuales.

**Fase 5 – Normalización de BD (instalaciones existentes)**: migración aditiva que crea las tablas de relación con grants y RLS, rellena sus datos a partir de los arrays y activa un doble registro temporal. Una segunda migración, más adelante, elimina los arrays, `category` y `asset_type_id` legado. Los estados se unifican con una migración de mapeo y CHECKs nuevos. No se borran datos sin verificarlos antes.

**Fase 6 – Identidad y documentos**: columnas `*_person_ref` y `evidence_ref` en paralelo a las FKs actuales; los servicios pasan a usar los puertos y, al final, se quitan las FKs a `auth.users`.

**Fase 7 – Seguridad**: el tenant activo se valida en servidor (el servidor comprueba la pertenencia en cada llamada y `localStorage` queda solo como preferencia); auditoría de `SECURITY DEFINER` y `search_path`; el QR pasa a un token con caducidad y respuesta mínima; cierre y reapertura por RPC transaccional con permiso `mnt.close/reopen`; hash del PDF calculado en servidor.

**Fase 8 – Línea base limpia**: `supabase/module-baseline/maintenance.sql` solo con las tablas `mnt_*`, funciones, políticas y seeds de familias de sistema, pensado para ICORE. Es independiente del historial de las 21 migraciones, que no se reescribe.

**Fase 9 – Paquete de exportación**: `modules/maintenance` + baseline + `adapters/icore` stub + README del contrato.

Archivos afectados principalmente: todas las rutas `_app.{assets,asset-*,checklist-*,maintenance*,incidents*,certificate*}`, `components/{first-aid-kit-panel,asset-history-panel,attachments-panel,external-certificate-dialog}`, `lib/{asset-families,checklist-scope,maintenance-scope,cert-status,certificate-*,import}`. No se tocan settings, dashboard, login, onboarding ni el shell (quedan como host standalone).

## F) Riesgos, decisiones pendientes y pruebas

Riesgos: regresiones en `maintenance.$id` (833 líneas); pérdida de integridad durante el doble registro; cambios de estado que rompan certificados ya emitidos (se mantienen como instantánea inmutable).

Decisiones pendientes para ICORE:
- ¿ICORE ofrece membresía o permisos como función SQL invocable desde RLS, o solo como API? Esto decide si hay RLS nativa o un servidor intermedio.
- ¿Las identidades de ICORE comparten `auth.users` con el mismo proyecto de base de datos?
- ¿Existe un motor de importación y un sistema de firma en ICORE?
- ¿Vehículos y botiquines son submódulos del mantenimiento o activos globales de ICORE?
- Prefijo de tablas (`mnt_`) o esquema propio (`maintenance.`).

Pruebas mínimas y criterios de aceptación:
- Ninguna importación de `@/integrations/supabase` fuera de `modules/maintenance/data` y de `adapters` (lo comprueba el lint).
- Tests de dominio en verde; el typecheck y el build no dan errores.
- RLS: un usuario de la empresa A no lee ni escribe en la B en ninguna tabla `mnt_*`, y anon no accede a nada salvo al RPC del QR.
- Recorrido completo sin cambios visuales: crear plan por familia → abrir sesión → responder checklist → incidencia → cerrar → certificado → historial del activo.
- La línea base se aplica sobre una base de datos vacía sin depender de companies ni locations.

## G) Contrato de integración (propuesta)

```ts
interface MaintenanceHost {
  tenant:  { currentOrgId(): Promise<string> };
  authz:   { can(perm: MntPermission, orgId: string): Promise<boolean> };
  people:  { current(): Promise<PersonRef>; search(q: string): Promise<PersonRef[]>;
             get(ids: string[]): Promise<PersonRef[]> };
  sites:   { tree(orgId: string): Promise<SiteNode[]>;
             expand(ids: string[], withChildren: boolean): Promise<string[]> };
  docs:    { upload(f: File, meta: EvidenceMeta): Promise<EvidenceRef>;
             signedUrl(ref: EvidenceRef): Promise<string>;
             newVersion(ref: EvidenceRef, f: Blob): Promise<EvidenceRef> };
  audit:   { emit(e: MntDomainEvent): Promise<void> };
}
// El módulo expone:
export function MaintenanceProvider(p: { host: MaintenanceHost; children }): JSX.Element;
export const maintenanceRoutes: RouteDefinition[];
export type MntDomainEvent =
  | { type: "mnt.session.closed"; orgId; sessionId; outcome }
  | { type: "mnt.incident.opened" | "mnt.incident.closed"; orgId; incidentId; assetId }
  | { type: "mnt.certificate.issued"; orgId; certificateId; evidence: EvidenceRef }
  | { type: "mnt.asset.expiring"; orgId; assetId; field; date };
```

En base de datos, el módulo requiere del host una función `host_has_perm(org_id uuid, perm text) returns boolean` (security definer, estable), que usan todas las políticas `mnt_*`. En modo standalone se implementa sobre `company_members`.

## H) Condiciones obligatorias (incorporadas; prevalecen sobre lo anterior si hay conflicto)

**1. Integridad multi-tenant.** `org_id NOT NULL` en todas las tablas `mnt_*`, incluidas hijas (items, responses, questions, versions, certificate_items, status_history, reopen_log, kit_contents, vehicle_mounts) y tablas de unión (`mnt_plan_assets`, `mnt_plan_sites`, `mnt_checklist_template_types`, `mnt_checklist_template_sites`, `mnt_plan_type_templates`). Todos los padres llevan `UNIQUE (org_id, id)` y las hijas, FKs compuestas `(org_id, parent_id) REFERENCES parent(org_id, id)`. Así se impide a nivel de esquema relacionar filas de organizaciones distintas. Las tablas de sistema (familias y tipos globales) se modelan con `org_id` nulo + tabla puente por organización, o se copian por organización; esta decisión se toma en la fase 5.

**2. Organización canónica.** En ICORE, `org_id` referencia mediante FK la tabla de organizaciones de ICORE. El paquete portable declara esa FK como prerrequisito de instalación en el manifest (punto 10); no queda como UUID anónimo. En modo standalone la FK apunta a `companies`.

**3. Autorización.** `AuthzPort.can()` solo sirve para mostrar u ocultar elementos de la interfaz. La autoridad real está en RLS y en las RPC. `host_has_perm(org_id uuid, perm text)`:
- obtiene la identidad solo de `auth.uid()` y nunca recibe el usuario como parámetro;
- es `SECURITY DEFINER`, `STABLE`, con `SET search_path = ''` y nombres totalmente cualificados;
- falla de forma cerrada: devuelve false si `auth.uid()` es nulo, la organización no existe o el permiso es desconocido;
- tiene `REVOKE ALL FROM PUBLIC, anon` y `GRANT EXECUTE TO authenticated`.

Cerrar, reabrir y emitir certificado solo son posibles mediante RPC transaccionales que comprueban el permiso dentro de la propia función.

**4. Eventos y auditoría.** Se usa un transactional outbox (`mnt_outbox`, o el outbox del host si ICORE lo ofrece, según el manifest). Las RPC de cierre y reapertura de sesión, apertura, cambio de estado y cierre de incidencia, y emisión de certificado escriben la mutación de dominio y el evento en la misma transacción. Un worker del host consume el outbox con clave de idempotencia (`event_id`). Para no duplicar la auditoría, en modo ICORE se retiran los triggers `audit_trigger_fn` de las tablas `mnt_*` y `AuditPort` deja de emitir desde el cliente. En modo standalone los triggers actuales se mantienen hasta la fase de corte.

**5. Secuencia de migraciones (siempre hacia delante):**
```text
M1 crear tablas normalizadas + org_id + UNIQUE/FK compuestas (NOT VALID)
M2 backfill idempotente (INSERT ... ON CONFLICT DO NOTHING)
M3 reconciliación: vistas/consultas de recuento array vs tabla, referencias huérfanas, filas cross-org -> informe; no se borra nada
M4 sincronización temporal controlada (trigger de doble escritura) solo si hace falta
M5 cambiar las lecturas de repositorios al modelo normalizado
M6 VALIDATE CONSTRAINT + checks de reconciliación en verde
M7 (migración posterior y separada) retirar arrays, category y asset_type_id legado
```
Si algo falla, se corrige con una migración compensatoria nueva, nunca con rollback destructivo. Las migraciones redundantes 20260907192726/192916 se documentan y no se tocan.

**6. Activos: decisión explícita.** Objetivo: registro compartido de activos de ICORE consumido mediante `AssetPort`. Mantenimiento conserva sus especializaciones (`mnt_vehicle_details`, `mnt_vehicle_mounts`, `mnt_first_aid_kit_contents`, familias y tipos de mantenimiento si ICORE no los tiene) referenciando `asset_ref`. MVP: los activos siguen dentro del módulo, pero solo son accesibles mediante `AssetPort` (repositorio `assets` detrás del puerto). Ninguna página ni servicio consulta la tabla directamente, de modo que después se pueden extraer sin afectar a quien los usa.

**7. Identidad histórica.** Además de `person_ref`, se guarda una instantánea inmutable (`actor_snapshot jsonb`: nombre, puesto o rol, interno/externo, proveedor, NIF del proveedor si aplica) en sesiones (técnico y firmante), respuestas (quien responde), reaperturas, firmas y certificados. La instantánea se escribe en la RPC y un trigger impide modificarla después.

**8. Certificados y documentos.** Mantenimiento guarda los metadatos del certificado (código, sesión, plan, ítems, resultado, vigencia de negocio) y sus relaciones. ICORE guarda el archivo, la versión, el hash, la vigencia documental y la evidencia. `mnt_certificates.document_version_ref NOT NULL` una vez emitido. Se retiran `pdf_url` y `pdf_hash_sha256` locales (en M7).

**9. Contrato documental independiente del navegador.**
- Servicio de dominio: `DocumentService.registerVersion({ orgId, kind, subject, bytesRef | stream, mime, meta }) -> DocumentVersionRef`, ejecutado en servidor. El servidor calcula el SHA-256 y registra la versión.
- Adaptador web (`adapters/web/upload.ts`): convierte `File/Blob` en una subida firmada y llama al servidor function. Solo la interfaz lo usa.
- El PDF del certificado se genera o vuelve a verificar en servidor (pdf-lib es compatible con Workers).

**10. Manifest de prerrequisitos del host** (`modules/maintenance/host-manifest.json` + `preflight.sql`):
- `contractVersion` (semver);
- tablas y funciones requeridas: org table + PK, `host_has_perm`, `host_current_person()`, sitios (`host_site_tree`), documentos (`host_register_document_version`), outbox (opcional);
- permisos requeridos: `mnt.view, mnt.manage_assets, mnt.run, mnt.close, mnt.reopen, mnt.certify, mnt.admin`.

El preflight aborta la instalación con un error claro (fail-fast) si falta algo o no coincide la versión. También se ejecuta al iniciar el módulo (`MaintenanceProvider`), que no se monta si falla.

**11. Pruebas ampliadas:**
- inserción y actualización cross-org rechazadas por FK compuesta y por RLS;
- cambio de organización activa con consultas en caché: las query keys incluyen `orgId` y el caché se invalida al cambiar;
- cierre y reapertura concurrentes (dos transacciones: una gana y la otra recibe un error controlado; `SELECT ... FOR UPDATE` en RPC);
- emisión duplicada de certificado (clave idempotente `UNIQUE (org_id, session_id) WHERE status <> 'revoked'`);
- migraciones y backfills idempotentes (ejecutar dos veces da el mismo resultado);
- actor eliminado o desactivado: el historial muestra la instantánea;
- versión documental retirada: el certificado conserva la referencia y el hash;
- QR caducado, revocado y limitado por tasa (tabla `mnt_qr_tokens` con `expires_at`, `revoked_at` y límite por IP/token).

**12. Vitest.** Se añaden `vitest` (+ `@vitest/coverage-v8`), `vitest.config.ts` con alias `@`, script `test` en package.json y la carpeta `modules/maintenance/**/__tests__`. Las pruebas SQL y RLS se ejecutan con un script contra una base de datos de prueba (pgTAP o consultas asertivas vía psql).

**13. Alcance.** No hay cambios de interfaz ajenos al desacoplamiento, no se publica y no se conecta GitHub. Cada fase se divide en commits pequeños y revisables.

### Ajustes al contrato (sección G)
- `docs` cambia a `registerVersion(input: DocumentVersionInput): Promise<DocumentVersionRef>` sin `File/Blob`. La subida web queda en el adaptador web.
- Se añaden `assets: AssetPort` (`get`, `list`, `search`, `byQr`) y `manifest: { contractVersion; preflight(): Promise<PreflightResult> }`.
- `audit` se sustituye por el outbox del lado servidor. El cliente no emite eventos de auditoría.
