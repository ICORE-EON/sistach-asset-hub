# Roadmap – desacoplamiento del módulo de mantenimiento

## Flujo QR operativo autenticado 2026-10-29 (APROBADO plan rev. 2)
- [x] Retirar endpoint público QR con privilegios; resolución autenticada por RPC con respuesta genérica.
- [x] Asignación de operarios por sesión; run/close/admin separados en servidor.
- [x] Ejecución idempotente, excepciones motivadas (solo mnt.close), cierre bloqueado con pendientes, historial de cierre.
- [x] Regeneración de QR con hash del token anterior; impresión de la nueva etiqueta.
- [x] UI móvil portable (SessionRunPage) + wrappers standalone; contrato ScanContract, stub iCore fail-closed.
- [x] SQL portable + pruebas temporales, Vitest, manifiesto y documentación.

## Cierre final de exportación 2026-10-29 (AUTORIZADO, sin funciones nuevas)
- [x] Sincronizar documentación, contratos y manifiesto real, distinguiendo exportado/probado/host/stub (143 operaciones).
- [x] Handoff único con fuentes de verdad iCore, instalación/actualización, rollback y aceptación.
- [x] Cobertura de operaciones/exportación y smoke metrológico efímero; 217 SQL PASS, baseline previa congelada; 418 Vitest app y 285 aisladas.
- [x] Paquete content-addressed por SHA-256 con sumas por archivo, sin datos demo ni despliegue; build automático observado OK.
- [ ] Typecheck independiente: bloqueado por prohibición de invocación manual y ausencia de evidencia separada del entorno. No se marca aprobado ni se declara aceptación completa. Adaptador/host real iCore deliberadamente fuera de alcance; aceptación en destino según handoff.

Los apartados históricos siguientes conservan resultados de sus fechas, no representan pendientes actuales. El cierre final y `spec/INTEGRATION_HANDOFF.md` son la referencia vigente; M2–M7 están canceladas.

## Corrección funcional Activos–Metrología 2026-10-29 (AUTORIZADA)
- [x] Asociación operativa N:1 independiente de identidad 1:1; SQL aditivo Sistach/ICORE y 210 PASS PostgreSQL temporal.
- [x] Vinculación múltiple y alta existente desde activo principal; nombres coherentes y detalle de todas las versiones de registros.
- [x] Columna y filtros, contratos/manifiesto/documentación; Vitest 270 PASS / 15 omitidas, build OK; navegador autenticado de Toni Enterprises sin escrituras.
- [ ] E2E de guardado/visor con instrumentos: bloqueado por acceso del solicitante solo a Toni Enterprises (sin instrumentos ni centros) y prohibición de TEST permanente; reglas verificadas en SQL temporal. Informe: spec/DELIVERY_METROLOGY_CORRECTION_2026-10-29.md.
- Host/adaptador real ICORE permanece fuera de alcance; no modificar registros existentes ni crear TEST permanentes.

## Unificación Activos–Metrología 2026-10-28 (bloqueo histórico SUPERADO por fases 1–2)
- [ ] Vinculación mínima de identidad y navegación bidireccional, sin duplicados, cambios históricos ni limpieza automática.
- Bloqueo material comprobado: el instalador independiente no contiene ninguna de las ocho tablas metrológicas ni sus operaciones atómicas; el adaptador ICORE no ofrece metrología. Añadir solo asset_id en Sistach no entrega la unificación portable autorizada. Portar el motor completo requiere resolver org/company, site, personas, permisos, documentos y snapshots, y comprobar instalación limpia/upgrade; excede una corrección pequeña. Se detiene antes de migrar o cambiar contratos/UI/datos.
- Alternativa A: vínculo primero en Sistach, conservando motor y entregando contrato/documentación portable, pero dejando instalación metrológica ICORE pendiente (coste relativo bajo; requiere aceptar esa excepción de alcance).
- Alternativa B: portar primero el motor metrológico existente al instalador independiente, sin reescribirlo, y añadir vínculo/UX/pruebas en ambos esquemas (coste relativo alto, varias veces A; requiere autorizar ese prerrequisito).
- En esta solicitud solo documentación y preferencias: ninguna migración, escritura de registros, TEST ni cambio funcional; pruebas de unificación no ejecutadas porque no se implementó. Host ICORE real no integrado.

## Reparaciones correctivas 2026-10-27 (EN CURSO — solo bloque autorizado)
- [ ] Edición descriptiva de abiertas con control de conflicto, sin modificar actuaciones/activos/incidencias/vencimientos.
- [ ] Cancelación con motivo visible, borrado de borrador vacío por RPC existente y reactivación desmarcada.
- [ ] Sincronizar contrato/SQL/manifiesto ICORE; ejecutar regresiones y navegación sin escrituras reales ni TEST permanentes.
- Buscador de equipo aplazado: los candidatos actuales carecen de tipo/centro; ampliar su contrato excede la reutilización sencilla autorizada. Host ICORE real fuera de alcance.

## Selector de activos con búsqueda 2026-10-26 (COMPLETADO — alcance Planes)
- [x] Selector portable en Planes → Añadir activos y Nuevo plan → Equipos concretos: código/nombre/tipo/centro sin acentos, contexto, resultados paginados y selección múltiple conservada al buscar; lectura completa mediante repositorio actual, sin cambiar permisos/datos/esquema.
- [x] Vitest 269 PASS / 4 omitidas, 33 archivos: búsqueda, selección, lectura de 1201 candidatos, aislamiento/guardas, manifiesto y SQL ICORE temporal. Build observado OK; navegador autenticado desktop/móvil con datos existentes, dos seleccionados conservados al filtrar y Añadir activos abierto; cero errores, sin guardar/vincular/TEST. Typecheck separado no ejecutado por restricción del entorno.
- [x] Exportados dominio/componente/pruebas y requisitos DTO documentados, sin nuevas dependencias ni contratos. Reparaciones/otros vínculos aplazados: DTO limitado a id/código/nombre y 500 filas con distinta elegibilidad, ampliación no simple. Host/adaptador ICORE real sigue pendiente; no integrado ni afirmado. Persistencia/cambio real de permisos en navegador no ejercidos; inventarios extremos no medidos.

## Corrección acotada de sugerencias 2026-10-26 (COMPLETADA)
- [x] 37 intervenciones concretas, notas y seis propuestas trimestrales/anuales orientativas revisables; resto a definir por empresa. Aplicación explícita, 13 códigos antiguos conservados, ningún cambio en planes/datos.
- [x] Vitest 257 PASS / 4 omitidas, incluida instalación SQL en PostgreSQL temporal y manifiesto. Build observado OK; typecheck manual separado no ejecutado por restricción del entorno. Navegador autenticado verifica nombre/notas/frecuencia y selección previa intacta hasta aplicar; formulario móvil sin desbordamiento, cero errores y sin guardar/TEST.
- [x] Catálogo/UI/tests ya incluidos en manifiesto ICORE; no requiere migración ni seed/alteración de instalador. Dependencias y límites vigentes en `spec/INSTALL_ICORE.md`; integración real del host/adaptador y adaptador real de metrología pendiente; SQL y relaciones implementados después. E2E de nueva persistencia no realizado por prohibición de escribir datos.

## Entrega acotada 2026-10-26 — portabilidad y sugerencias (ENTREGADO con bloqueo de host/metrología)
- [x] Sincronizados clasificación, ejecución, guarda técnica, catálogo v2 y manifiesto completo. SQL temporal 150 PASS/ALL_DONE, actualización con plan legado intacto. Host real NO integrado; portado SQL metrológico completado posteriormente, adaptador real pendiente, ver `spec/INSTALL_ICORE.md`.
- [x] Sugerencias opcionales en Nuevo plan: 13 tareas prácticas, origen sin especificar, frecuencia y equipos confirmados; navegador autenticado sin escritura, cero errores. E2E de persistencia no ejecutado por restricción TEST. Vitest 237 PASS/4 omitidas, incluida completitud de manifiesto; build OK; typecheck separado no ejecutado por restricción del entorno.
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

- [x] Metrología opción B Fase 1 (2026-10-29): `src/modules/maintenance/sql/install_metrology_v1.sql` — 8 tablas, 15 funciones; PostgreSQL temporal 185 PASS/ALL_DONE. Pendiente: adaptador TS ICORE, host real, código MTR automático en ICORE. Fase 2 autorizada e implementada después (ver sección siguiente).

## Metrología Fase 2 — vínculo Activo ↔ Metrología (2026-10-29)
- [x] `mnt_mtr_equipment.asset_id` opcional, misma org, único, definitivo, sin cascada (Sistach + `install_metrology_v1.sql`).
- [x] Ficha de activo: tarjeta Metrología (Activar / Gestionar); ficha metrológica: enlace al activo o «Vincular a activo» con buscador.
- [x] Con vínculo, código/nombre/ubicación mostrados salen de Activos; datos de control y etiquetas/historial previos se conservan.
- [ ] Adaptador TS de metrología ICORE + conexión al host real (pendiente, fuera de alcance).
- [ ] Prueba con escritura en navegador (activar/vincular) — no hecha para no crear registros reales.
