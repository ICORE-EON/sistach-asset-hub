# Verificación final · 2026-10-29 UTC

## Resultado por comprobación (no intercambiables)

| Comprobación | Resultado | Evidencia / alcance |
|---|---|---|
| Instalación limpia PostgreSQL temporal | **PASS** | core sin host falla sin residuos; core+catálogo limpio; add-on sin core falla; Metrología limpia sin add-on previo: 8 tablas |
| Actualización previa soportada | **PASS** | SQL literal commit c15a30cf34e2ffc1e45ca2be14189d28359fff48 → actual; plan/equipo poblados y huellas originales intactas, principal legado NULL |
| SQL reglas/idempotencia/rollback/concurrencia | **217 PASS**, ALL_DONE, salida 0 | `bash src/modules/maintenance/sql/__tests__/run.sh`; cluster/socket propios en /tmp, conexiones empresariales anuladas, cluster destruido |
| Smoke Metrología efímero | **6 PASS** (incluidos en 217) | crear/leer como authenticated, 2 instrumentos N:1 por RPC, COMMIT y nueva conexión, org B no ve/no asocia, fixture eliminada |
| Vitest del módulo en app | **418 PASS / 15 SKIP**, 31 archivos aprobados / 6 omitidos | `bunx vitest run src/modules/maintenance`; incluye SQL, contratos, dominio, servicios/fronteras y regresiones standalone |
| Vitest de exportación aislada | **285 PASS / 20 SKIP**, 22 archivos aprobados | ejecutado desde /tmp/mnt-export-check, solo archivos exportados; dependencias de prueba enlazadas desde proyecto, no incluidas en ZIP |
| Build de la app | **PASS automático observado** | `/tmp/observability/build-errors.log`: build OK; ejecución del entorno separada de tests, no build manual |
| Typecheck independiente | **NO EJECUTADO / NO ACREDITADO** | el entorno prohíbe invocación manual y no ofrece log separado de tipos; build OK no demuestra esta comprobación |
| Integración real iCore / E2E navegador host | **NO EJECUTADO** | fuera de alcance; no queries ni adaptador real, capabilities false |

Las omisiones del módulo incluyen 11 tests live standalone y 4 del host iCore. En paquete aislado: 15 checks de wrappers de la app, 1 de cableado standalone y 4 live iCore. **Ninguno se declara aprobado**. Las pruebas de wrappers se mantienen para la app pero se omiten al faltar sus rutas en la exportación, no se exporta el shell.

## Cobertura real
- 143 operaciones: 111 base, 8 correctivas, 24 metrológicas. La prueba por operación valida que hay contrato, clave de manifiesto y rechazo explícito del stub con nombre de operación en org A/B. Presencia SQL de las RPC atómicas; no equivalente a 143 pruebas funcionales live.
- Tipado `satisfies Record<...>` de capacidades opcionales y detección de claves rotas por Vitest; cambios de firma deben verificarse además mediante typecheck del destino.
- Manifiesto incluye todos los archivos portables y dependencias locales; seis tests de servicios dependientes de standalone excluidos, no silenciados en regresión de app.
- El harness exportado corregido se reejecuta con bash bajo usuario no privilegiado; antes el ZIP sin bit ejecutable falló. El fallo detectado quedó resuelto y la exportación aislada pasó.
- Baseline previa congelada, no sintetizada quitando bloques del instalador actual. Prueba no acredita todas las versiones anteriores posibles.
- Comprobaciones SQL preservan preventivos/historial/identidad única/N:1/tenant y no usan datos reales de esta app. El smoke no prueba API/UI ni adaptador real iCore.

## Repetición
Ver `tools/README.md`, config `tools/vitest.export.config.ts`, `sql/__tests__/run.sh`, fixtures históricas con SHA y smoke. Del ZIP extraído: `sha256sum -c SHA256SUMS`; validar ZIP con `tools/export-package.py --verify <ZIP>`. Ejecutar tests desde su raíz, no desde app con root alternativo (afecta checks de cableado).

## Archivos de entrega modificados / añadidos
- Documentación: EXPORT.md, README.md, spec/INSTALL_ICORE.md, HOST_CONTRACTS.md, DTO_MAPPING.md, ICORE_ADAPTER_SPEC.md, ICORE_DECISIONS.md, ambas DELIVERY*.md, sql/INTEGRATION.md; nuevos INTEGRATION_HANDOFF.md y este informe.
- Inventario: host-manifest.json, spec/EXPORT_MANIFEST.json; `contracts/export-operations.ts` nuevo (catálogo exportado sin cambiar catálogo base/casos de uso).
- Stub: adapters/icore/index.ts (nombres SQL corregidos), repositories.ts (24 rechazos metrológicos); comentario actualizado en contracts/repositories.ts. **Cero consultas reales**.
- Tests: handoff-contracts.test.ts nuevo; export-completeness.test.ts, operations.test.ts, contract-suite.ts; fronteras UI; SQL harness/install.pg.test.ts, dos fixtures smoke y baseline SQL literal+README.
- Herramientas: tools/export-package.py, vitest.export.config.ts y README; roadmap.md y AGENTS.md en repositorio de origen.
- **No cambios** a UI funcional, handlers, servicios operativos, instaladores actuales, esquemas/datos reales ni producción. Copias SQL históricas solo para pruebas.

## Bloqueos y conclusión exacta
Paquete técnico entregable y verificable por hashes; **no aceptación técnica completa** porque no se acredita el typecheck independiente solicitado. Debe ejecutarse por separado en destino junto con build/tests. El adaptador real, mapeo canónico, código MTR, seguridad documental transaccional/acciones, rutas/QR y aceptación live iCore son responsabilidades deliberadas del host; no implementadas ni simuladas como funcionamiento. No declarar «listo para integrar/activar» sin resolver esos criterios.

SHA final del payload y archivo: `PACKAGE_RECEIPT.json` / sidecar ZIP. No insertar el SHA del propio archivo dentro de este informe para evitar autorreferencia. Sin publicación ni despliegue.