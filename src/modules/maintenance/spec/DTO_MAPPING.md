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

## Actualización 2026-10-26
- `plan_nature`, `requirement_origin`, `requirement_reference`: mismas columnas/códigos en `mnt_plans`; el instalador conserva permiso `mnt.admin` de gestión de planes; el host debe mapear gestión sin conceder borrado administrativo a roles no administradores. Origen por defecto `unspecified`; nunca inferido.
- `execution_mode` / `default_provider`: mismas columnas en `mnt_plans`; sesiones usan `is_external` / `external_provider`.
- `active` / `archived_at` del DTO plan: mapear desde `status = active/paused/archived`, no crear dos autoridades de estado.
- Fichas: `mnt_asset_types.metadata.technical_profile`; `mnt_assets.metadata.technical = {profile,version,values}`. Valores y referencias GWP conservados exactamente; validación UX declarativa, SQL de forma y RLS autoritativa.
- Catálogo v2: convertir código físico de tipo a `metadata.catalog_code` (p.ej. `ext_polvo` → `EXT-POLVO`) al devolver el DTO. Al escribir, buscar código físico normalizado, nunca insertar el código con guiones en la tabla ICORE (CHECK existente). Tipos propios usan normalización y código original en metadata.
- Categorías: el esquema limpio usa familias; `listCategories/saveCategory/deleteCategory` necesitan integración explícita del host, no existen tablas duplicadas de categorías.
- Sugerencias: catálogo en código, no tabla ni activación. Código de plan estable `SUG-*`, único por org. La UI exige confirmar frecuencia/activos; la primera fecha puede quedar NULL. No escribe al seleccionar.
- Selector de activos: reutiliza `plans.listScopeAssets` → `ScopeAsset` sin nueva operación. Devolver código/nombre, tipo (`code`, `name_i18n`), ubicación (`name`) y su id; jerarquía `ScopeLocation` aporta centro padre. Resultado completo solo de `orgId`, no borrados/no retirados y sujeto al ámbito actual; paginar internamente la lectura si hay límite de API. UI busca sin acentos por todos esos campos y pagina resultados; conserva IDs seleccionados fuera de búsqueda.
