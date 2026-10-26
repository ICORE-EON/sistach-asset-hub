# Instalación y aceptación dentro de ICORE

## Orden de instalación
1. Copiar al repositorio de ICORE los archivos de `EXPORT_MANIFEST.json` (`include`).
2. ICORE crea sus puntos de integración SQL (`HOST_CONTRACTS.md` §1–5) y los roles `anon`, `authenticated`, `service_role`.
3. Ejecutar `sql/install_v1.sql` (transaccional, idempotente; aborta sin crear nada si falta un requisito).
4. Opcional: `sql/seed_catalog_v1.sql` (5 familias y 14 tipos globales; ninguno se activa para ninguna organización).
   Para biblioteca actual añadir `sql/seed_inventory_v2.sql` (9 familias / 51 tipos sugeridos, códigos originales y perfil en metadata). Conserva v1 y no sobrescribe filas existentes ni activa tipos. Catálogos y perfiles declarativos se copian también con el manifiesto.
5. Registrar organizaciones: `select mnt_register_org(<org>)` con service_role. Activar tipos por organización explícitamente.
6. Implementar `adapters/icore/repositories.ts` sustituyendo cada `nc(...)` (ver `ICORE_ADAPTER_SPEC.md`).
7. Registrar una sola vez al arrancar: `registerMaintenanceAdapter({ id: "icore", repositories })`.
8. Montar `MaintenanceUiProvider` con `{ request: { orgId, userId, role }, Attachments }` y las rutas envoltorio (path/head/component) hacia `ui/pages/*`.
9. Configurar el consumidor de `mnt_outbox`.

## Configuración necesaria
- Dependencias npm usadas por el paquete: `react`, `@tanstack/react-query`, `@tanstack/react-router` (solo en envoltorios del host), `pdf-lib`, `zod`, `lucide-react`, `sonner`, kit UI `@/components/ui/*` y `@/lib/utils` (alias `@`).
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
4. Metrología: se incluyen contratos/servicios/UI/dominio pero **no hay instalador limpio ni adaptador metrológico ICORE**; mantener capacidad deshabilitada y no montar sus rutas hasta portar `mnt_mtr_equipment`, `mnt_mtr_control_plans`, `mnt_mtr_records`, `mnt_mtr_record_lines`, `mnt_mtr_impact_reviews`, `mnt_mtr_status_history`, `mnt_mtr_site_moves`, `mnt_mtr_unfit_decisions`; RPC `next_code`, `mtr_validate_record`, `mtr_rectify_record`, `mtr_decide_unfit`, `mtr_close_impact`, `mtr_move_site`, `mtr_set_status`, con identidad/tenant/permisos de ICORE. Rehacer ese esquema aquí sería una ampliación material, no una sincronización pequeña.

Dependencias npm completas en `EXPORT_MANIFEST.json`: no credenciales del standalone ni dependencias Node en runtime. PostgreSQL temporal valida instalación/aislamiento; staging con host real y E2E de escritura siguen siendo aceptación separada. Biblioteca de factores de emisión aplazada: no se proporcionan valores sin contrastar ámbito/año/fuente oficial; PCA/GWP existente permanece separado.
