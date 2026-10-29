# Corrección funcional Activos–Metrología · 2026-10-29

## Pantallas entregadas
- **Ficha de activo:** lista de instrumentos asociados al activo principal (N:1), estado y próximo control; selección múltiple de existentes libres; Nuevo equipo navega al alta existente con principal preseleccionado. Control de la misma identidad de inventario queda separado y accesible.
- **Alta existente de Metrología:** conserva nombre y tipo propios del instrumento; principal mostrado por lectura de la misma organización; no crea activos físicos; bloqueo de doble envío y sustitución de URL tras éxito.
- **Ficha metrológica:** activo principal y vínculo físico claramente separados. Nombre/ubicación de identidad física en solo lectura con «Editar nombre en Activos»; sin identidad, nombre editable también cuando hay principal asociado.
- **Calibraciones / verificaciones:** «Ver detalle» en todas las versiones, incluyendo sustituidas; datos, líneas, referencia, certificado de solo lectura, restricciones y navegación entre versiones. Ausencias como «—».
- **Listado:** columna de principal enlazado; filtros por principal, tipo de instrumento y tipo de activo; búsqueda normalizada por identidad visible y centro.

## Archivos principales
- `drizzle/migrations/0014_mtr_principal_asset_association.sql`: referencia opcional, FK compuesta RESTRICT, índice, guarda de asociación/nombre y RPC de lote invoker-rights.
- `sql/install_metrology_v1.sql`: misma lógica en org_id/mnt_assets; `mnt_mtr_associate_equipment`.
- `contracts/metrology.ts`, `services/metrology.ts`, `adapters/standalone/repos/metrology.repo.ts`.
- `ui/components/asset-metrology.tsx`, `ui/components/metrology-records.tsx`.
- `ui/pages/MetrologyEquipmentListPage.tsx`, `ui/pages/MetrologyEquipmentDetailPage.tsx` y sus wrappers de rutas.
- `sql/__tests__/run.sh`, `sql/__tests__/fixtures/metrology_tests.sql`, `services/__tests__/metrology-tenant.test.ts`, `adapters/standalone/repos/__tests__/metrology-names.test.ts`.
- `spec/HOST_CONTRACTS.md`, `spec/DTO_MAPPING.md`, `spec/EXPORT_MANIFEST.json`, `AGENTS.md`, `roadmap.md`.

## Comprobaciones
- Cambio aditivo aplicado en Sistach y presencia de asset_id/parent_asset_id confirmada por lectura; ninguna escritura de registros existentes ni TEST permanente.
- PostgreSQL temporal: **210 PASS, ALL_DONE** (instalador limpio/reinstalación, upgrade con equipo legado conservado, identidad única, N:1, duplicados idempotentes, lote conflictivo con rollback, tenants/RLS, nombre propio y nombre físico protegido, historial y planes preventivos intactos).
- Vitest: **270 PASS / 15 omitidas**, incluidos tests SQL temporales y dos tests concretos del adaptador de nombres.
- Última compilación automática observada: **build OK**. Typecheck separado no ejecutado: el entorno lo ejecuta automáticamente, no se afirma resultado independiente.
- Navegador autenticado con cuenta solicitante: ficha de activo de Toni Enterprises → selector existente → alta con principal preseleccionado → cancelar; desktop y listado móvil, sin errores JavaScript ni guardar. Esa cuenta solo tiene Toni Enterprises, con cero instrumentos y sin centros de control; por tanto no se ejercitaron edición/visor de registros con datos ni persistencia/selección múltiple en navegador.

## Límites explícitos
- Adaptador TypeScript y host real ICORE **siguen pendientes**; no se declara integración completa.
- Método y criterios textuales del detalle se identifican como datos del **plan actual**: el motor no proporciona snapshots históricos de esos campos; no se inventan. Valores, errores, tolerancias, modos y resultados se leen de las líneas existentes.
- Reasignación de instrumento ya asociado bloqueada; no se añade flujo de traslado/desvinculación ni limpieza de datos.
- Búsqueda de asociaciones muestra hasta 100 coincidencias a la vez sobre el listado existente; no se construye una pantalla compleja ni nueva capa de datos.
- E2E de guardado y de detalle con instrumentos reales pendiente por alcance de acceso y prohibición de crear TEST permanentes; validación de reglas/persistencia cubierta en PostgreSQL desechable, no sustituye integración real del host.
## Cierre documental posterior
Estado vigente y evidencias finales: INTEGRATION_HANDOFF.md / VALIDATION_FINAL.md. La posterior UX fue validada manualmente por el usuario: selector compartido catálogo/Otro/legado, nombre independiente frente a identidad, filas sin duplicar, separación «Equipos de medida asociados» y «Control metrológico del propio activo». No confundir esa aceptación manual con E2E automatizado ni con integración real iCore. Instalador y ambas relaciones están implementados/exportados; adaptador REAL sigue pendiente, con stub completo de rechazo.
