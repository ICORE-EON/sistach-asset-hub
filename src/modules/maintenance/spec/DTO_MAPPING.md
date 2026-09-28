# Correspondencia DTO del módulo ↔ conceptos de ICORE

Solo conceptual. El mapeo físico (tablas/columnas reales) se hará en el repositorio de ICORE.
Los DTO no se renombran: el adaptador de ICORE traduce.

| Campo/DTO actual | Concepto ICORE esperado | Esquema limpio (`install_v1.sql`) | Nota |
|---|---|---|---|
| `company_id` | organización canónica | `org_id` | siempre igual al `orgId` de la llamada |
| `location_id`, `locations {name, code}` | centro | `site_ref` + `SitePort` | nombre/código lo aporta el host |
| `parent_location_id` | centro padre | — (host) | jerarquía vía `SitePort.tree` |
| `scope_location_ids[]`, `location_ids[]` | centros del ámbito | tablas `mnt_plan_sites`, `mnt_checklist_template_sites` | arrays solo en el DTO |
| `asset_type_ids[]` | tipos del ámbito | `mnt_checklist_template_types` | idem |
| `name_i18n` (Json `{es,ca,en}`) | texto traducible | `name_i18n jsonb` | ICORE puede mapear a su sistema i18n |
| `category` (tipo de activo) | — | familia explícita | equivalencia versionada (D6) |
| `created_by`, `answered_by`, `published_by`, `technician_id`, `assigned_to` | persona | `*_person_ref uuid` | sin FK a usuarios |
| `technician_name`, `signer_name`, `signer_role`, `issuer_*` | snapshot de persona | `*_snapshot jsonb` | inmutable |
| `external_provider`, `is_external` | proveedor externo | snapshot `{external, provider}` | |
| `pdf_url`, `pdf_hash_sha256` | versión documental | `document_version_ref` + `sha256` | URL solo vía `DocumentPort.signedUrl` |
| `signature_image_url` | documento de firma | `document_version_ref` | |
| `logo_url` (plantilla) | recurso de almacenamiento | referencia del host | |
| `qr_token` | token público de activo | `qr_token` | caducidad a decidir en ICORE |
| `maintenance_items` / `result` | ítem de sesión | `mnt_session_items.result` | valores canónicos en `domain/status.ts` |
| `maintenance_plans`, `asset_families` (anidados) | relaciones | FK compuestas `(org_id, id)` | el adaptador compone el anidado |
| `status`, `outcome` (sesión, incidencia, certificado) | estado del módulo | columnas propias | solo cambian por RPC |
| `metadata` | extensión libre | `metadata jsonb` | |
| `signer_ip`, `signer_user_agent` | contexto de solicitud | lo aporta ICORE si lo exige | decisión ICORE |
