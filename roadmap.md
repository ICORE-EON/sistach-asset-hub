# Roadmap – desacoplamiento del módulo de mantenimiento

## Entrega acotada 2026-10-26 — portabilidad y sugerencias (EN CURSO)
- [ ] Sincronizar instalador ICORE: clasificación, ficha técnica, catálogo y manifiesto completo; validar instalación limpia/idempotencia/aislamiento. Host real no integrado.
- [ ] Sugerencias opcionales en Nuevo plan: 13 tareas prácticas, origen sin especificar, frecuencia y equipos confirmados; no modificar planes existentes.
- Biblioteca de emisiones aplazada en esta entrega: contrastar fuentes oficiales por ámbito/año antes de incluir cifras; priorizar portabilidad y sugerencias. Sin motor de huella ni cálculos automáticos.

- [x] Fase 0/1: Vitest, frontera `src/modules/maintenance`, contratos, manifest, dominio puro + tests
- [x] Fase 2: adaptadores standalone (tenant, authz, people, sites, assets, docs) + preflight + stub ICORE — esperando revisión antes de fase 3
- [ ] Fase 3: repositorios y servicios por dominio (quitar supabase.* de páginas)
  - [x] Bloque 1 activos/familias/tipos/botiquín (repo + servicio + prueba real) — esperando revisión — verificado: build prod + test cambio de organización (10 casos)
  - [x] Correctivo final bloque 6: «Sin revisar» ≠ N/A, PDF versionado inmutable (pendiente de aprobación)
  - [x] Bloque 2 checklists  - [x] Bloque 3 planes (pendiente de aprobación)  - [x] Bloque 4 sesiones (pendiente de aprobación)  - [x] 5 incidencias (pendiente de aprobación)  - [x] 6 certificados (pendiente de aprobación)
  - [ ] Verificar cambio de organización con 2 empresas (cuenta actual solo tiene 1)
- [x] Fase 4: mover UI a `modules/maintenance/ui` sin cambios visuales (pendiente de aprobación)
- [ ] Fase 5: migraciones M1–M7
  - [x] M1 aplicada (estructura aditiva, puentes, outbox, RLS). Las 24 FK compuestas sobre tablas existentes se retiraron (ambigüedad de relaciones en las consultas); siguen las 5 de tablas puente. Pruebas RLS 52/52. Pendiente de aprobación.
  - [ ] M2/M3: sin FK compuestas; coherencia por org cubierta con preflight y postflight bloqueantes (abortan si hay referencias cruzadas o company_id incoherente)
  - [ ] M4: triggers de sincronización/validación rechazan nuevas relaciones entre organizaciones; auditoría de tablas puente (org_id) operativa ANTES de permitir escrituras
  - [ ] M5: consultas con nombres de relación explícitos
  - [ ] M6: reintroducir las 24 FK compuestas (NOT VALID → VALIDATE) tras M5, con prueba de pantallas
  - [ ] M7: según plan v2 (bloqueado por incompatibilidad de plan D7)
- [ ] Fase 6: person_ref + actor_snapshot, document_version_ref
- [ ] Fase 7: seguridad (host_has_perm, RPC cierre/reapertura, QR con caducidad y límite)
- [ ] Fase 8: línea base limpia para ICORE
- [ ] Fase 9: paquete de exportación
- Bloqueado (decisiones ICORE): permisos como función SQL, auth.users compartido, motor de importación/firma, prefijo `mnt_` vs esquema

## Corrective fix for phases 0–1 (done)
- [x] Startup error "Uncaught undefined" fixed (auth listener filtered to identity changes; active company read after hydration; breadcrumb nested <li>)
- [x] Decisions resolved: SQL permissions (host_has_perm), identity via person_ref, mnt_ prefix in public
- [ ] Phase 2 — waiting for user authorization

## Paquete limpio ICORE (plan v2)
- [x] Paso 1: contratos estables + registro de adaptador + separación del host standalone (esperando revisión)
- [x] Paso 2: esquema limpio, catálogo y pruebas en PostgreSQL desechable (esperando revisión)
- [ ] Paso 3: adaptador ICORE, ficha de requisitos y lista de exportación — pendiente de aprobación

## Mantenimientos — Bloque 1A (navegación y consultas)
- [x] Próximos: sin agrupar por defecto, vencidos primero, filtros compactos
- [x] Histórico por intervenciones paginado + vista por activo
- [x] Planes: alcance vigente/vinculado y próximo vencimiento estimado
- [x] Bloque 1B: vencimientos — next_due_on por vínculo, bitácora mnt_due_changes, cierre atómico (interno/externo), primera fecha en alta de plan y al añadir equipos, excepciones por equipo en revisión externa. Suites: vitest 195/15 omitidas, SQL app 49/49, SQL paquete ICORE OK.

## Bloque 2A — COMPLETADO (Asset Guardian + instalador ICORE independiente verificados)
- [x] Cierre técnico 2026-10-25: SQL íntegro 51/51 tras autorización y guarda reforzada; regresión adicional PASS. ICORE limpio 107 PASS / 32 de 2A / ALL_DONE. Evidencias: `tests/sql/results/mnt_2a_2026-10-25.md`.
- [x] Documentados los tres eventos TEST inmutables; sin borrado ni datos permanentes nuevos. Huellas de datos antes/después idénticas durante este cierre.
- [x] Discrepancia 8/16/3 vs 7/6/2 explicada: totales globales frente a Sistach; 1 vínculo, 10 ítems y 1 documento extra son de Toni Enterprises y siguen presentes. Sin pérdida que explique los deltas (no reconstruible la consulta antigua ni auditoría histórica completa).
- [x] Cierre documental: conclusiones y medidas de prevención en el informe 2A.
- Trabajo posterior (fuera de 2A): integración real en host ICORE (adaptador, mapeo `mnt.admin`) y controles de documentos/incidencias del host; trazabilidad de vínculos/ítems/documentos en bitácora (limitación conocida).
- [x] Etapa 2: migraciones 0002–0005 (borrado seguro, evidencias, cancelar/desvincular, snapshot de frecuencia); SQL 2A 51/51; instalador ICORE ALL_DONE
- [x] Activo: Retirar/Reactivar y Eliminar seguro (UI)
- [x] UI plan: editar, archivar, eliminar, desvincular con motivo
- [x] UI sesión: cancelar con motivo, eliminar borrador vacío
- [x] Aviso de frecuencia legado en decisiones de cierre
- [x] Instalador ICORE con RPC 2A + pruebas; SQL B1B 49/49; Vitest; navegador PYME

## Bloque 2B — Reparaciones (EN CURSO)
- [x] Base de datos, seguridad y pruebas SQL (app 55/55, instalador ICORE 133 PASS / 26 de 2B)
- [x] Contratos, servicios, repositorio standalone y pantallas (Mantenimientos > Reparaciones, ficha de activo, incidencia)
- [ ] Prueba en navegador con datos TEST (pendiente decisión: los registros de reparación no se pueden borrar)
- [ ] Repetir batería 1B; adaptador ICORE TypeScript de reparaciones; documentación EXPORT/specs

## Reconducción ICORE (2026-10-26) — máximo 2 entregas
### Hito 1 — Activos inteligentes
- [x] **1A** Ficha técnica Climatización extremo a extremo: perfil en catálogo de sistema (código, declarativo), activado por empresa en cada tipo (Tipos de activo → Ficha técnica), campos en alta de activo y tarjeta ver/editar en la ficha del activo; valores tipados en `assets.metadata.technical`, guarda SQL de formato. Pendiente: aceptación del usuario y prueba en navegador con datos reales.
- [x] **1B** Asistente «Configurar inventario» (6 grupos, 18 tipos, sin duplicar), perfiles extintor/BIE/eléctrico/vehículo/medida, PCA AR4 (Reg. UE 517/2014) con fuente guardada. Vitest 205/15 omitidas; navegador hasta confirmar sin escribir.
- [x] **Biblioteca maestra**: 9 familias, 51 tipos (15 opcionales, no premarcados), 30 perfiles; vehículo v2 sin kilometraje, medida v2 con exactitud/uso/control; sugerencias de Equipos de medida alineadas. Sin migración (guard SQL solo valida forma). Vitest 216/15 omitidas.
- [ ] Pendiente: E2E con escritura (importar tipo + crear/editar activo) — requiere autorización para crear tipos en una empresa. Limpieza de datos ficticios: requiere alcance exacto.
### Hito 2 — (no iniciar) Clasificación de planes por naturaleza/origen (etiqueta, no verificación legal), catálogo de revisiones configurable, buscador de activos, edición/cancelación segura de reparaciones/planes/metrología sin borrar actividad real, coste estimado simple.
