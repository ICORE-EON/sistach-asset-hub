# Instalación y aceptación dentro de ICORE

Referencia normativa de entrega: **INTEGRATION_HANDOFF.md**. Los resultados históricos de este documento no sustituyen VALIDATION_FINAL.md.

## Orden de instalación
1. Copiar al repositorio de ICORE los archivos de `EXPORT_MANIFEST.json` (`include`).
2. ICORE crea sus puntos de integración SQL (`HOST_CONTRACTS.md` §1–5) y los roles `anon`, `authenticated`, `service_role`.
3. Ejecutar `sql/install_v1.sql` (transaccional, idempotente; aborta sin crear nada si falta un requisito).
   3b. Opcional Metrología: ejecutar después `sql/install_metrology_v1.sql` (transaccional, idempotente; aborta sin crear nada si falta `install_v1` o un contrato host).
4. Opcional: `sql/seed_catalog_v1.sql` (5 familias y 14 tipos globales; ninguno se activa para ninguna organización).
   Para biblioteca actual añadir `sql/seed_inventory_v2.sql` (9 familias / 51 tipos sugeridos, códigos originales y perfil en metadata). Conserva v1 y no sobrescribe filas existentes ni activa tipos. Catálogos y perfiles declarativos se copian también con el manifiesto.
5. Registrar organizaciones: `select mnt_register_org(<org>)` con service_role. Activar tipos por organización explícitamente.
6. Implementar `adapters/icore/repositories.ts` sustituyendo cada `nc(...)` (ver `ICORE_ADAPTER_SPEC.md`).
7. Registrar una sola vez al arrancar: `registerMaintenanceAdapter({ id: "icore", repositories })`.
8. Montar `MaintenanceUiProvider` con `{ request: { orgId, userId, role }, Attachments }` y las rutas envoltorio (path/head/component) hacia `ui/pages/*`.
9. Configurar el consumidor de `mnt_outbox`.

### Sugerencias de mantenimiento v2
El catálogo portable `domain/maintenance-suggestions.ts` contiene 37 intervenciones, consumidas por el mismo formulario del módulo. Copiar catálogo, selector, pantalla y pruebas mediante el manifiesto existente: no requiere migración ni seed SQL adicional y no crea planes. Mantiene los 13 códigos anteriores. Seis propuestas trimestrales/anuales son orientativas y editables; el resto queda a definir por empresa, sin origen legal automático. El usuario aplica explícitamente y revisa frecuencia/equipos antes de guardar. La corrección no cambia dependencias del host ni supone integración real.

## Configuración necesaria
### Reparaciones: edición segura 2026-10-27
El instalador idempotente incorpora `mnt_update_corrective(org,session,expected_updated_at,description,priority,external,provider,technician_name)`; requiere `mnt.run`, bloquea la fila de la organización y rechaza cambios concurrentes (40001), preventivos y reparaciones cerradas/canceladas. No escribe fechas, actuaciones, incidencias ni vínculos preventivos. El responsable descriptivo se conserva en `technician_snapshot.name`; no sustituye identidad autenticada.
El DTO `CorrectiveRow` debe devolver `updated_at` exacto y `cancellation_reason` desde `metadata.cancel.reason`; implementar `corrective.update` en el adaptador real. El esqueleto continúa fail-closed. Cancelación y borrado vacío reutilizan `mnt_cancel_session` / `mnt_delete_draft_session`; el host documental debe rechazar borradores con adjuntos dentro de la operación autorizada, tal como exige 2A. Integración real del host y este control documental no están probados ni completados por esta entrega.
UI: Mantenimientos → Reparaciones y listados en ficha de activo. Edición solo descriptiva; cancelación deja motivo visible; borrado solo se ofrece para draft y la RPC decide elegibilidad. Las altas existentes arrancan in_progress, por lo que no son borradores vacíos. Reactivación desmarcada al abrir/reabrir y al cambiar resultado. Buscador de equipo aplazado por DTO insuficiente.

### Selector de activos
`ui/components/asset-picker.tsx` y `domain/asset-search.ts` están incluidos en el manifiesto; no añaden dependencias ni SQL. Se usan en Planes → Añadir activos y Nuevo plan → Equipos concretos. El adaptador existente `plans.listScopeAssets(orgId, query)` debe devolver todos los candidatos elegibles del tenant, paginando internamente cuando la API limite filas; el selector pagina solo la presentación (40 por página) y busca sobre todo el conjunto recibido. Proveer `asset_types.code/name_i18n`, `locations.name` y la jerarquía existente de centros (`ScopeLocation`) para búsqueda/contexto; no cambiar contratos ni permisos. La búsqueda no amplía candidatos, no hace escrituras y no habilita activos retirados/borrados.

Reparaciones y otros vínculos no se modifican: `incidents.listAssetOptions` devuelve solo id/código/nombre y está limitado a 500; ampliarlo a tipo/centro con cobertura total requiere trabajo adicional en contrato/adaptador. No sustituirlo por candidatos de planes, pues difiere la elegibilidad. Integración real ICORE sigue pendiente; el esqueleto permanece fail-closed.

- Dependencias npm usadas por el paquete: `react`, `@tanstack/react-query`, `@tanstack/react-router` (también usado por la UI portable), `pdf-lib`, `zod`, `lucide-react`, `sonner`, kit UI `@/components/ui/*` y `@/lib/utils` (alias `@`).
- Variables de entorno: el paquete no lee ninguna; las credenciales de base y almacenamiento son del host.
- PostgreSQL ≥ 15 (probado en 16/17), `gen_random_uuid()` disponible.

## Validación
1. `bunx vitest run src/modules/maintenance` → frontera, dominio, servicios, catálogo de operaciones y contrato nivel «shape».
2. `bash src/modules/maintenance/sql/__tests__/run.sh` → instalador sobre PostgreSQL temporal con host simulado (valida el SQL, no ICORE).
3. Repetir los escenarios de `sql/__tests__/fixtures/tests.sql` contra una base de staging de ICORE con sus funciones `host_*` reales.
4. Ejecutar `defineRepositoryContract({ name: "icore", repos, live })` con un host real (dos organizaciones, usuario con permisos en A y sin permisos en B).

## Criterios de aceptación en ICORE
- Preflight del instalador sin requisitos pendientes; `host_has_perm` devuelve false sin sesión.
- Contrato «shape» y «live» en verde con el adaptador real (no con simulaciones).
- Aislamiento: ninguna lectura/escritura cruza organizaciones; usuario sin organización y anónimo sin acceso.
- Cierre de sesión, incidencias, publicación de checklist y certificados solo vía RPC; transiciones inválidas rechazadas por la base.
- Certificado con `document_version_ref` cuyo SHA-256 coincide con el del sistema documental.
- Eventos de `mnt_outbox` consumidos y marcados; recorrido manual por las pantallas de Activos, Planes, Sesiones, Incidencias y Certificados.
- Bloque 2A: probar las cinco RPC (`mnt_delete_asset`, `mnt_delete_plan`, `mnt_unlink_plan_asset`, `mnt_cancel_session`, `mnt_delete_draft_session`) y sus permisos; `mnt.admin` para borrado definitivo debe corresponder exclusivamente a administradores.
- El host debe bloquear, en su autoridad SQL y dentro de la operación de borrado, dependencias documentales directas/indirectas y borradores con evidencia; proteger filas y objetos de documentos de cierres/certificados y sus incidencias. No añadir tablas documentales duplicadas al módulo. Ver `sql/INTEGRATION.md`.
- Instalación local comprobada el 2026-10-25: 107 PASS (32 de 2A), `ALL_DONE`; no equivale a aceptación en el ICORE real.

## Entrega actual y límites obligatorios
Reejecutar el instalador actualizado sobre instalaciones `mnt_*` anteriores añade clasificación, ejecución y guardas de ficha sin reclasificar planes ni reprogramar fechas. No ejecutar sobre Sistach para convertir su esquema: los adaptadores traducen DTOs (`DTO_MAPPING.md`). Catálogos v2 son opcionales y no importan activos/planes.

El adaptador TS sigue siendo un **esqueleto fail-closed**, no un adaptador conectado: incluye operaciones correctivas con sus nombres contractuales. El host debe implementar las consultas/RPC con `orgId` explícito y devolver los DTOs anidados. La instalación SQL con host simulado no equivale a integrar el host ICORE real.

Dependencias exactas del host pendientes:
1. Funciones SQL `host_has_perm`, `host_person_ref`, `host_person_snapshot`, `host_site_in_org`, `host_document_version_sha`, identidad `auth.uid()`, roles y registro `mnt_register_org`; permisos del contrato (la gestión de planes del instalador actual requiere `mnt.admin`; no simular un permiso inexistente ni concederlo a gestores no administradores).
2. Repositorios reales, mapeos de estados/códigos/centros/personas, categorías de inventario y proveedores de UI/adjuntos; rutas para todos los enlaces de las pantallas, React Query, kit UI y estilos del host.
3. Sistema documental con versiones, almacenamiento y protección transaccional de evidencias/incidencias; consumidor outbox y generación/almacenamiento de certificados.
4. Metrología (Fase 1, opción B): `sql/install_metrology_v1.sql` instala las 8 tablas `mnt_mtr_equipment`, `mnt_mtr_control_plans`, `mnt_mtr_records`, `mnt_mtr_record_lines`, `mnt_mtr_unfit_decisions`, `mnt_mtr_impact_reviews`, `mnt_mtr_site_moves`, `mnt_mtr_status_history` con `org_id` → `mnt_orgs`, FKs compuestas anti-cruce, RLS por `mnt_can` (`mnt.view`/`mnt.manage_assets`/`mnt.run`/`mnt.close`), guardas e inmutabilidad, y las funciones del motor (más la RPC posterior de asociación): RPC `mnt_mtr_validate_record`, `mnt_mtr_rectify_record`, `mnt_mtr_decide_unfit`, `mnt_mtr_close_impact`, `mnt_mtr_move_site`, `mnt_mtr_set_status`; internas `mnt_mtr_log_status`, `mnt_mtr_reference_eligible`, `mnt_mtr_calc_next_due`; triggers `mnt_mtr_tg_*` (6). Es traslado del motor de Sistach, no reescritura. Registra `mnt_installation_addons('metrology',1)` y emite `mnt.mtr.record_validated` al outbox. **Pendiente:** adaptador TypeScript metrológico ICORE, conexión al host real, generación de código `MTR-AAAA-NNNN` (en ICORE el alta debe aportar `code`; `mnt_next_code` existe pero no se invoca automáticamente). Instalador portable ≠ integración: mantener la capacidad deshabilitada y no montar sus rutas hasta conectar repositorios, adjuntos e identidad.

Dependencias npm completas en `EXPORT_MANIFEST.json`: no credenciales del standalone ni dependencias Node en runtime. PostgreSQL temporal valida instalación/aislamiento; staging con host real y E2E de escritura siguen siendo aceptación separada. Biblioteca de factores de emisión aplazada: no se proporcionan valores sin contrastar ámbito/año/fuente oficial; PCA/GWP existente permanece separado.


## Metrología Fase 2 (vínculo Activo ↔ Metrología)
`install_metrology_v1.sql` añade de forma idempotente `mnt_mtr_equipment.asset_id` (nullable) con FK compuesta `(org_id, asset_id) → mnt_assets(org_id, id) ON DELETE RESTRICT`, índice único parcial `(org_id, asset_id)` para equipos no borrados y el trigger `mnt_mtr_tg_asset_link_guard` (activo de la misma org y no borrado; vínculo definitivo una vez fijado). Equipos sin activo siguen siendo válidos. **SQL, contrato, servicio y UI portable implementados/exportados**; el cableado de rutas y el adaptador REAL iCore siguen pendientes. El stub actual incluye las 24 operaciones metrológicas, todas rechazadas explícitamente.

## Actualización soportada y asociación N:1
Solo se ha verificado como baseline histórica la revisión `c15a30cf34e2ffc1e45ca2be14189d28359fff48` de ambos instaladores, congelada en `sql/__tests__/fixtures/previous/`. Aplicar `install_v1.sql` actual y después `install_metrology_v1.sql` actual. Añade `parent_asset_id` y `mnt_mtr_associate_equipment`, conserva filas originales y principal NULL. Repetir catálogos opcionales v1→v2 solo si se desean, sin activaciones automáticas. No se afirma compatibilidad con cualquier esquema `mnt_*`, ni upgrade del legado Sistach; validar otra baseline en staging antes de operar.

Orden limpio completo, precondiciones, comandos, rollback y aceptación se detallan en INTEGRATION_HANDOFF.md. No ejecutar fixtures ni adaptadores standalone en destino.
