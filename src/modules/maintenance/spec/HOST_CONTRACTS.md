# Contratos que debe implementar ICORE

Dos niveles: **SQL** (autoridad, lo usa `install_v1.sql`) y **TypeScript** (puertos de `contracts/index.ts`, solo UX/datos auxiliares).
Aquí no se fijan tablas, nombres ni servicios reales de ICORE: eso se decide en su repositorio.

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
