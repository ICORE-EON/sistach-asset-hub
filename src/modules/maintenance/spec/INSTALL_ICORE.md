# Instalación y aceptación dentro de ICORE

## Orden de instalación
1. Copiar al repositorio de ICORE los archivos de `EXPORT_MANIFEST.json` (`include`).
2. ICORE crea sus puntos de integración SQL (`HOST_CONTRACTS.md` §1–5) y los roles `anon`, `authenticated`, `service_role`.
3. Ejecutar `sql/install_v1.sql` (transaccional, idempotente; aborta sin crear nada si falta un requisito).
4. Opcional: `sql/seed_catalog_v1.sql` (5 familias y 14 tipos globales; ninguno se activa para ninguna organización).
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
