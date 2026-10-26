# Paquete exportable del módulo de mantenimiento

Se exporta (portable, sin dependencias de esta app):
- `contracts/` — contratos estables: puertos de host, capacidades de datos (`repositories.ts`), registro de adaptador (`registry.ts`).
- `domain/` — reglas puras, catálogos propios (familias/tipos i18n, botiquín, plantillas de certificado, estado de certificados).
- `services/` — casos de uso; reciben `orgId` (y `userId` cuando aplica) de forma explícita en cada llamada.
- `render/` — generación del PDF de certificado (pdf-lib).
- `ui/` — pantallas y componentes; leen el contexto de solicitud de `ui/host.tsx` (`MaintenanceUiProvider`).
- `sql/` — instalador limpio `install_v1.sql`, catálogo `seed_catalog_v1.sql`, `INTEGRATION.md` y sus pruebas (el host simulado de `sql/__tests__/fixtures` es solo de pruebas).
- `manifest/`, `host-manifest.json`, pruebas `__tests__` de estas carpetas.

NO se exporta:
- `adapters/standalone/` — host de esta aplicación (cliente de base de datos, contextos de empresa/usuario, panel de adjuntos, repositorios sobre las tablas actuales y sus pruebas de integración).
- Cableado de la app: `src/router.tsx` (registro del adaptador), `src/routes/_authenticated/_app.tsx` (proveedor de UI) y las rutas envoltorio.

Requisitos del host: registrar un adaptador con `registerMaintenanceAdapter({ id, repositories })` una sola vez al arrancar,
montar `MaintenanceUiProvider` con `{ request: { orgId, userId, role }, Attachments }`, y proveer el kit UI `@/components/ui/*` y `@/lib/utils`.
La prueba `ui/__tests__/module-boundary.test.ts` impide que las capas exportables dependan de esta app.

Manifiesto exacto de archivos incluidos/excluidos: `spec/EXPORT_MANIFEST.json`. Especificación de integración en `spec/`
(`ICORE_ADAPTER_SPEC.md`, `HOST_CONTRACTS.md`, `DTO_MAPPING.md`, `INSTALL_ICORE.md`, `ICORE_DECISIONS.md`).
El esqueleto `adapters/icore/repositories.ts` sí se exporta; no se registra en esta app.

Actualización 2026-10-26: manifiesto regenerado para incluir todos los archivos portables actuales, fichas/catálogos, clasificación, sugerencias y correctivos. `seed_inventory_v2.sql` aporta catálogo actual sin activación. El instalador admite actualización aditiva de planes y guardas técnicas. Metrología se incluye como código opcional pero su SQL/adaptador ICORE sigue pendiente; no declarar integración completa del host. Límites y dependencias exactos en `spec/INSTALL_ICORE.md`.

Corrección de sugerencias v2: 37 intervenciones en el catálogo declarativo compartido; los archivos ya están incluidos en el manifiesto. No requiere seed SQL ni modificación del instalador y conserva códigos antiguos/planes guardados. Aplicación explícita de nombre, nota y frecuencia orientativa editable; sin obligación legal automática.
