# Instalación del módulo de mantenimiento en ICORE (esquema limpio v1)

Orden: 1) el host provee los puntos de integración; 2) `install_v1.sql`; 3) `seed_catalog_v1.sql`;
4) el host registra cada organización con `mnt_register_org(org_id)` (service_role).
Ambos scripts son idempotentes y transaccionales. El instalador falla antes de crear nada si falta un requisito.

## Puntos de integración que aporta ICORE

| Área | Contrato SQL | Reglas |
|---|---|---|
| Roles | `anon`, `authenticated`, `service_role` | service_role con BYPASSRLS (consume outbox) |
| Identidad | `auth.uid()` y `public.host_person_ref() → uuid` | persona canónica ICORE; sin FK a auth.users |
| Personas | `public.host_person_snapshot(uuid) → jsonb` | `{name, role, external, provider}`; se congela en cierres, historial y certificados |
| Permisos | `public.host_has_perm(org uuid, perm text) → boolean` | SECURITY DEFINER, search_path fijo, deriva de auth.uid(), **false** sin sesión (lo comprueba el preflight). Permisos: `mnt.view, mnt.manage_assets, mnt.run, mnt.close, mnt.reopen, mnt.certify, mnt.admin` |
| Organizaciones | `public.mnt_register_org(uuid)` (lo llama ICORE) | `mnt_orgs` es el registro local; todas las filas de organización tienen `org_id NOT NULL` |
| Centros | `public.host_site_in_org(org, site) → boolean` | valida cada `site_ref` (activos, sesiones, incidencias, ámbitos) |
| Documentos / almacenamiento | `public.host_document_version_sha(org, ref) → text` | el PDF lo genera y guarda ICORE; el módulo solo guarda `document_version_ref` + SHA-256 y exige que coincidan |
| Auditoría | tabla `mnt_outbox` | cada RPC escribe cambio + evento en la misma transacción; ICORE lee con service_role y marca `processed_at` |

## Modelo (tablas `mnt_*`)
Catálogo global (org_id NULL, is_system): `mnt_asset_families`, `mnt_asset_types`; activación explícita por organización en `mnt_org_asset_types` (nunca automática).
Organización: `mnt_assets`, `mnt_kit_items`, `mnt_checklist_templates` (+`_types`, `_sites`), `mnt_checklist_versions`, `mnt_checklist_questions`,
`mnt_certificate_templates`, `mnt_plans` (+`_sites`, `_assets`, `_type_templates`), `mnt_sessions`, `mnt_session_items`, `mnt_responses`,
`mnt_session_history`, `mnt_incidents`, `mnt_incident_history`, `mnt_certificates`, `mnt_certificate_items`, `mnt_counters`, `mnt_outbox`.
Sin arrays de UUID: ámbitos en tablas de relación. Relaciones entre tablas del módulo con FK compuestas `(org_id, id)`.

## Operaciones atómicas (RPC, SECURITY DEFINER, search_path fijo)
`mnt_create_session` (idempotente por request_id), `mnt_close_session`, `mnt_reopen_session`, `mnt_open_incident`,
`mnt_change_incident_status`, `mnt_publish_checklist_version`, `mnt_attach_certificate_pdf`, `mnt_revoke_certificate`,
`mnt_register_external_certificate`. Estados de sesión, incidencia y certificado solo cambian por RPC.

## Pruebas
`__tests__/run.sh` levanta un PostgreSQL temporal y desechable, instala el host simulado (`fixtures/host_stub.sql`, solo pruebas),
el esquema y el catálogo, y ejecuta las comprobaciones. No se conecta nunca a la base de la aplicación.

## Bloque 2A — edición, desactivación y eliminación controlada

- Los clientes (`authenticated`) no pueden borrar físicamente `mnt_assets`, `mnt_plans`, `mnt_plan_assets`, `mnt_sessions` ni `mnt_session_items` (trigger `mnt_delete_guard`). Solo estas RPC, tras comprobar actividad/evidencias en la misma transacción:
  - `mnt_delete_asset(org, asset, confirm)` y `mnt_delete_plan(org, plan, confirm)` — permiso `mnt.admin`; con `confirm=false` solo devuelven `{eligible, blockers, remove}`. El plan elimina sus sesiones vacías solo con confirmación y las lista antes.
  - `mnt_unlink_plan_asset(org, plan, asset, reason)` — `mnt.admin`; vínculo nunca usado → se quita (`link_removed`); usado → `end_on = ayer` en la zona de la organización (`unlink`, motivo obligatorio). `end_on` es inclusivo.
  - `mnt_cancel_session(org, session, reason)` — `mnt.run`; motivo obligatorio, historial `cancelled`, evento `session.cancelled`, no mueve fechas, idempotente.
  - `mnt_delete_draft_session(org, session)` — `mnt.run`; solo borradores sin resultados, observaciones, respuestas, certificados, historial ni cambios de fecha.
- Archivar un plan = `status = 'archived'` (ya existente); no se borra el historial.
- Las sesiones guardan `metadata.plan_frequency` al crearse; el cierre usa esa periodicidad (`mnt_session_months`). Sesiones sin ella usan la frecuencia vigente del plan.
- **Responsabilidad del host ICORE:** los documentos y archivos viven en el DocumentPort del host. El host debe impedir borrar (fila y objeto de almacenamiento) documentos vinculados a una sesión cerrada o a un certificado, y las incidencias del host originadas en un cierre. Si ICORE necesita que el borrado definitivo sea solo de "administrador", debe mapear `mnt.admin` a ese rol (o separar un permiso propio).
