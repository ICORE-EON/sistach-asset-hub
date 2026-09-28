# MVP Control de equipos de medida (submódulo `metrology` del módulo de mantenimiento)

Ampliación dentro de `src/modules/maintenance` reutilizando contratos, registro de adaptador, `MaintenanceUiProvider`, SitePort/PeoplePort/DocumentPort y adaptador standalone. No se toca el paquete limpio de ICORE ni `install_v1.sql` hasta validar la funcionalidad. Sin migrar ni limpiar datos ficticios.

## 1. Pantallas y flujo

- **Resumen** (`/metrology`): contadores (total, vencidos, próximos 30/60/90, no aptos, impactos pendientes) + distribución por site; filtro de site. Clic en contador abre inventario filtrado.
- **Inventario** (`/metrology/equipment`): tabla con código, nombre, tipo, site, responsable, próximo control, método, días restantes, estado; filtros site/responsable/tipo/método/estado/vencimiento; alta en diálogo.
- **Ficha** (`/metrology/equipment/$id`), pestañas:
  - Resumen: identificación, características metrológicas, foto, banner rojo persistente de evaluación de impacto pendiente.
  - Plan de control: lista de controles (varios simultáneos), alta/edición/desactivación.
  - Calibraciones/verificaciones: registros; «Nuevo registro» elige control planificado; formulario según tipo; guardar borrador / validar; rectificar registro validado.
  - Documentos: panel de adjuntos existente (slot del host).
  - Historial: traslados de site, cambios de estado, validaciones, rectificaciones, decisiones e impactos.
- **Flujo No apto**: al validar No apto → diálogo obligatorio de decisión (retirar / reparar-ajustar / restringir uso / repetir control) + se crea seguimiento de impacto pendiente con texto normativo fijo. El seguimiento se cierra desde la ficha (evaluado, conclusión, justificación, referencia NC/acción opcional).
- **Filtro por site** añadido a los listados existentes de Activos, Planes y Sesiones (solo un selector; Activos ya lo tiene, Sesiones/Planes usan `location_id`/ámbito ya existente). Sin rediseño.
- Entrada en la barra lateral: «Equipos de medida».

## 2. Entidades (tablas `mnt_mtr_*`, todas con `company_id` NOT NULL y UNIQUE `(company_id,id)`; FK compuestas `(company_id, x_id)` entre ellas)

- `mnt_mtr_equipment`: code (único por org, `next_code` MTR), name, equipment_type (texto catálogo simple), magnitude, intended_use, site_id (NOT NULL, validado por `host_site_in_org`), location_detail (texto opcional), responsible_ref + responsible_snapshot, brand, model, serial_number, photo_document_ref, range_min/range_max/unit, resolution, declared_accuracy, restrictions, registered_on, status, deleted_at.
- `mnt_mtr_control_plans`: equipment_id, control_kind (calibration/verification/check), method (external/internal), procedure, frequency_unit (days/months/years/before_use), frequency_value, acceptance_criteria, responsible_ref, next_due_on, requires_document, active.
- `mnt_mtr_records`: equipment_id, control_plan_id, kind, performed_on, performer_ref + snapshot, result (fit/unfit), next_due_calculated, next_due_override + override_reason, observations, document_ref, status (draft/validated/superseded), version, supersedes_id, validated_by_ref + snapshot, validated_at.
  - Detalle externo (columnas en el propio registro, nullables): laboratory, certificate_number, accreditation, declared_uncertainty, adjusted_or_repaired.
  - Detalle interno: reference_equipment_id (FK compuesta al propio inventario).
- `mnt_mtr_record_lines`: record_id, position, label, reference_value, measured_value, deviation (calculada), tolerance, result. Para comprobaciones: mismo esquema con solo label + result.
- `mnt_mtr_unfit_decisions`: record_id, decision (retire/repair/restrict/repeat), notes, decided_by_ref + snapshot, decided_at.
- `mnt_mtr_impact_reviews`: equipment_id, record_id, status (pending/evaluated), responsible_ref, reviewed_on, period_reviewed, conclusion (no_impact/impact), justification, external_ref_type (nc/action), external_ref_id, external_ref_label, external_ref_url.
- `mnt_mtr_site_moves`: equipment_id, from_site_id, to_site_id, moved_at, moved_by_ref (append-only).
- `mnt_mtr_status_history`: equipment_id, from_status, to_status, cause, record_id, changed_at, changed_by_ref (append-only).
- Auditoría: triggers del `audit_trigger_fn` existente en las tablas nuevas.

## 3. Estados y transiciones

Estado almacenado del equipo: `operational`, `unfit`, `out_of_service`, `retired`. Estados derivados (no almacenados): `due_soon` (≤30 días) y `overdue` según el `next_due_on` mínimo de controles activos. `before_use` no genera vencimiento.

```text
operational --validar No apto--> unfit
unfit --decisión retire--> retired (final)
unfit --decisión repair/repeat--> out_of_service --control validado Apto--> operational
unfit --decisión restrict--> operational (con restricción anotada)
operational <--> out_of_service (manual, con motivo)
```
Registro: `draft -> validated` (inmutable) `-> superseded` solo al validar su rectificación (nueva versión con `supersedes_id`). Impacto: `pending -> evaluated` (final).

## 4. Operaciones atómicas (RPC SECURITY DEFINER, search_path fijo, permiso comprobado dentro)

- `mtr_validate_record(record_id)`: bloquea fila; calcula resultado global desde líneas (una línea no apta ⇒ no apto); en verificación interna comprueba que el patrón es otro equipo de la org, operativo, sin impacto pendiente y con control vigente en la fecha; exige documento si el plan lo requiere; fija `next_due_on` del plan (calculado o ajuste con motivo); marca `validated`; si No apto → estado `unfit`, historial e impacto `pending`, todo en una transacción.
- `mtr_rectify_record(record_id, reason)`: crea borrador versión+1; al validarlo, el anterior pasa a `superseded`.
- `mtr_decide_unfit(record_id, decision, notes)`: registra decisión y aplica transición.
- `mtr_close_impact(review_id, ...)`: cierra evaluación.
- `mtr_move_site(equipment_id, site_id)`: actualiza site y registra traslado.
- Triggers: inmutabilidad de registros validados, líneas de registros validados, historiales y decisiones.

## 5. Permisos (reutiliza roles actuales vía funciones `can_*`)

- Ver: `can_view` (todos los roles, incl. auditor).
- Inventario y planes de control: `can_manage_assets` (administrator, system_manager).
- Crear/editar borradores: `can_run_maintenance` (+ employee).
- Validar, rectificar, decidir No apto, cerrar impacto: `can_close_session` (administrator, system_manager, manager).
- Nuevos permisos de contrato: `mnt.mtr.view/manage/record/validate` mapeados en AuthzPort standalone a esos roles (solo UX).

## 6. Cambios mínimos en contratos / adaptador / app

- `contracts/repositories.ts`: nuevo bloque `MetrologyRepository` con DTOs propios; `MaintenanceRepositories` gana `metrology` (opcional en stub ICORE: lanza «no implementado»).
- `contracts/`: nuevo `ExternalRefPort` (tipo, id, etiqueta, url) — en standalone solo guarda la referencia.
- `domain/metrology/`: reglas puras (cálculo próxima fecha, estado derivado, resultado global de líneas, elegibilidad de patrón, transiciones).
- `services/metrology.ts` + query keys con orgId.
- `adapters/standalone/repos/metrology.repo.ts` y registro en el adaptador.
- `ui/pages/Metrology*.tsx` + rutas envoltorio finas + entrada en sidebar.
- Selector de site en Planes y Sesiones.
- `EXPORT_MANIFEST.json` sin tocar hasta validar (se anota en roadmap).

## 7. Bloques con parada

1. **B1 Esquema + dominio** (imprescindible): migración de tablas, RLS, RPC, triggers; reglas de dominio y pruebas unitarias; pruebas RLS SQL por perfil. Parada.
2. **B2 Contratos + adaptador + servicios** (imprescindible): repositorio, servicio, pruebas de frontera y propagación de orgId, suite de contrato. Parada.
3. **B3 Inventario + ficha (Resumen, Plan de control, Documentos, Historial)** (imprescindible). Parada.
4. **B4 Registros y validación + flujo No apto + impacto** (imprescindible). Parada.
5. **B5 Resumen/contadores + filtro de site en listados existentes** (imprescindible el resumen; recomendable los filtros de listados). Parada.

## 8. Pruebas y criterios de aceptación

- Unitarias: próxima fecha (días/meses/años/antes de uso, fin de mes), estado derivado, resultado global de líneas, elegibilidad de patrón, transiciones.
- SQL/RLS contra la base de esta app con dos empresas ficticias en transacción revertida: aislamiento, anónimo, rol insuficiente, patrón de otra org rechazado, registro validado inmutable, rectificación trazable, No apto ⇒ estado + impacto en una transacción, rollback si falla.
- Frontera: domain/services/ui sin Supabase ni rutas.
- Navegador: crear equipo, plan (calibración externa 5 años + verificación interna anual), registrar verificación con una línea fuera de tolerancia, validar ⇒ No apto, banner visible en resumen/inventario/ficha, decidir, cerrar impacto.
- Se mantienen 182 pruebas + 4 en vivo omitidas; typecheck y build OK.

## 9. Estimación

- Imprescindible: B1–B4 y el resumen de B5.
- Recomendable: filtro de site en Planes/Sesiones, historial de traslados en pantalla, foto del equipo.
- Prescindible en MVP: catálogo gestionable de tipos de equipo (texto libre con sugerencias basta), notificaciones de vencimiento por email, exportación del inventario.

## Decisiones a confirmar en revisión
- Tipos de equipo como texto libre con sugerencias (no catálogo) en el MVP.
- Umbral «próximo a vencer» = 30 días.
- Decisión «restringir uso» devuelve el equipo a operativo con restricción visible.
