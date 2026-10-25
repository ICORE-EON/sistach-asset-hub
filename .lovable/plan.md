# Bloque 2A — Edición, desactivación y eliminación controlada (alcance mínimo PYME) · rev. 2

Solo auditoría y plan. No se ha modificado código, esquema ni datos. Incorpora las siete precisiones de la revisión.

## 1. Estado actual confirmado (código + BD)

| Entidad | Ya existe | Observado |
|---|---|---|
| Activo | Editar (`updateAsset`), estado `retired`, borrado lógico `softDeleteAsset` desde la ficha | Retirados/borrados ya salen de Próximos y sesiones nuevas. UI no distingue Retirar de Eliminar; no hay borrado físico. FK: `maintenance_items.asset_id` RESTRICT; `maintenance_plan_assets`, `documents`, `first_aid_kit_contents`, `vehicles` CASCADE; `incidents`, `certificate_items` SET NULL. |
| Plan | Pausar/Reactivar (`setActive`), plantilla de certificado, añadir equipos, programar fechas | No se edita nombre/frecuencia/notas/proveedor. Sin eliminar/archivar. FK: vínculos, plantillas por tipo y `mnt_plan_sites` CASCADE; sesiones SET NULL. |
| Vínculo | `removeAsset` = DELETE físico sin confirmación ni motivo | `end_on` existe y es **inclusivo** (filtros `end_on >= hoy` en creación de sesión y Próximos, `sessions.repo.ts`). No se usa en UI. |
| Sesión | Snapshot del plan al crear (`metadata.snapshot.plan` con `frequency` e `interval_months`) | **Pero** la propuesta de cierre (`listDuePreview`) y las RPC de cierre leen la frecuencia **viva** del plan, no el snapshot. Sin «Cancelar» ni «Eliminar borrador». Un DELETE arrastraría ítems, respuestas y documentos. |
| Resultados | Editables solo con sesión abierta | Correcto. |
| Certificado | Revocar, editar notas | Correcto, sin borrado en UI. |
| Documentos | Panel del host; DELETE RLS solo administrador | Sin protección de evidencias de sesiones cerradas (fila ni archivo en almacenamiento). |
| Incidencia | Editar y eliminar definitivamente | Puede borrarse aunque proceda de un ítem cerrado. |

Auditoría genérica: triggers `trg_audit_*` en activos, planes, vínculos, sesiones, ítems, certificados y documentos.

## 2. Reglas

R1. Retirar / Pausar / Archivar / Desvincular / Cancelar conservan historia y son la acción por defecto.
R2. Eliminar definitivamente solo si no hay **evidencia** (definición en §4). Comprobación y borrado en una única función de base de datos, transaccional, con permisos verificados en servidor. Si hay evidencia, la función rechaza con motivo y la UI ofrece la alternativa.
R3. Ninguna cascada silenciosa: la función enumera lo que va a borrar (vínculos sin uso, borradores vacíos) y la UI lo muestra en la confirmación antes de llamar con `p_confirm = true`.
R4. Editar un plan nunca cambia fechas programadas ni sesiones ya creadas.
R5. Los botones de borrado físico no aparecen hasta que las funciones de §4 y sus pruebas SQL estén validadas (secuencia §9).

## 3. Matriz de estados, acciones y permisos (corregida)

Permisos existentes: gestionar activos = `can_manage_assets`; gestionar planes = mismo nivel de gestión usado hoy por `mnt_sa_set_due`; ejecutar = `can_run_maintenance`; administrador = `can_manage_company`.

| Entidad / estado | Acción | Permiso (servidor) | Grupo |
|---|---|---|---|
| Activo | Editar datos | gestionar activos | ya existe |
| Activo | Retirar / Reactivar | gestionar activos | a |
| Activo sin evidencia | Eliminar definitivamente (limpia vínculos sin uso) | administrador | b |
| Activo con evidencia | Eliminar rechazado → Retirar | — | b |
| Plan | Editar nombre, notas, proveedor, frecuencia | gestionar planes | a |
| Plan | Pausar / Reactivar | gestionar planes | ya existe |
| Plan con evidencia | Archivar / Desarchivar | gestionar planes | b |
| Plan sin evidencia (solo borradores vacíos y vínculos sin uso) | Eliminar definitivamente tras listar borradores | administrador | b |
| Vínculo en uso | Desvincular ahora (motivo obligatorio) | gestionar planes | b |
| Vínculo nunca usado | Quitar (corrección de alta) | gestionar planes | b |
| Sesión borrador vacía | Eliminar borrador | ejecutar mantenimiento | b |
| Sesión borrador / en curso / reabierta | Cancelar con motivo | ejecutar mantenimiento | b |
| Sesión cerrada | Sin borrado; Reabrir (ya existe) | según reapertura actual | — |
| Certificado | Revocar | ya existe | — |
| Documento de sesión cerrada o certificado | Borrado denegado | servidor | b |
| Incidencia de ítem de sesión cerrada | Eliminar denegado; cerrar/cancelar permitido | servidor | b |

## 4. Elegibilidad para borrar y seguridad de evidencias

**Evidencia** (bloquea borrado físico; obliga a Retirar/Archivar):
- sesión con estado distinto de `draft`, o borrador con algún ítem cuyo resultado no sea `pending`, respuestas de checklist o documentos;
- `certificate_items` o certificados que referencien el activo/plan/sesión;
- documentos ligados al activo, a sus sesiones o ítems;
- incidencias ligadas al activo o a sus ítems;
- filas en `mnt_due_changes` con motivo (reprogramaciones manuales) — se conservan siempre; su existencia no bloquea, pero el vínculo pasa a desvinculación en vez de borrado (decisión sencilla: la bitácora nunca queda referida a un vínculo inexistente).

**Activo eliminable**: sin evidencia. Elimina en la misma transacción sus vínculos nunca usados y borradores vacíos que solo lo contengan (listados antes en la confirmación). Contenido de botiquín se borra con él (no es evidencia de mantenimiento).

**Plan eliminable**: sin evidencia. Paso 1 explícito: la UI muestra «Este plan tiene N borradores vacíos; se eliminarán». Paso 2: la función borra borradores vacíos, vínculos sin uso, plantillas por tipo, sites y el plan. Con evidencia → Archivar (`status='archived'`, `active=false`), oculto por defecto en Planes y fuera de Próximos.

**Evidencias protegidas** (precisión 5), mínimo y sin módulos paralelos:
- Trigger `BEFORE DELETE` en `documents`: rechaza si el documento está ligado a una sesión cerrada, a un ítem de sesión cerrada o a un certificado emitido/revocado.
- La función de servidor que borra archivos del panel de adjuntos (`adapters/standalone/documents.functions.ts`) comprueba lo mismo antes de borrar el objeto del almacenamiento.
- Trigger `BEFORE DELETE` en `incidents`: rechaza si `source_maintenance_item_id` pertenece a una sesión cerrada.
- Responsabilidades: estos dos triggers y la comprobación de la función de archivos son **locales del standalone** (documentos e incidencias son del host). En la exportación ICORE se documenta como requisito del host en `spec/ICORE_ADAPTER_SPEC.md` y `host-manifest.json`: «DocumentPort/IncidentPort deben rechazar el borrado de evidencias de sesiones cerradas». El paquete ICORE no incluye esos triggers.

## 5. Snapshot de frecuencia (precisión 3)

- Ya existe: cada sesión guarda `metadata.snapshot.plan.frequency` e `interval_months` al crearse.
- Cambio mínimo: el cálculo de propuesta en cierre (`listDuePreview` y `mnt_sa_plan_months` usado por `mnt_sa_close_session` / `mnt_sa_record_external`) lee primero el intervalo del snapshot de la sesión; solo si falta usa el plan vivo.
- Sesiones abiertas preexistentes: comprobado en código que el snapshot se escribe desde la creación de sesiones; las que no lo tengan (legado) usan la frecuencia vigente del plan y el panel de cierre lo indica con una línea «Periodicidad actual del plan (sesión sin registro de periodicidad)». La propuesta siempre es editable, por lo que no se inventa cumplimiento. Se cuenta en la migración cuántas abiertas carecen de snapshot (lectura, sin modificar datos).
- Sin motor de versiones: no se versiona el plan.
- Diálogo de edición de plan avisa: «Las fechas ya programadas y las sesiones abiertas mantienen la periodicidad anterior; el cambio se aplica a sesiones nuevas.»

## 6. Desvincular ahora (precisión 4)

- `end_on` es inclusivo hoy. «Desvincular ahora» guarda `end_on = ayer` en la zona horaria de la empresa: desde hoy no aparece en Próximos ni en sesiones nuevas, sin cambiar la semántica de los filtros existentes.
- Si `start_on` es posterior a ayer (vínculo aún no iniciado) y nunca usado → se trata como corrección de alta y se quita físicamente; si tiene uso, `start_on` no se toca y se fija `end_on = start_on - 1` solo si no rompe restricciones; si hay restricción `end_on >= start_on` se comprobará al implementar y, en su caso, se elimina el vínculo solo si no tiene evidencia.
- Sesiones abiertas que ya contienen ese equipo no se modifican; el cierre sigue funcionando (el equipo ya está en la sesión).
- Auditoría diferenciada: nueva columna `kind` en `mnt_due_changes` (`due_change` por defecto, `unlink`, `link_removed`) con usuario de servidor, fecha, vínculo, `end_on` aplicado y motivo obligatorio. Alternativa si se prefiere no tocar la bitácora: tabla `mnt_link_events`; recomiendo la columna (menos piezas).
- Terminación con fecha futura: aplazada (no trivial en UI de PYME).

## 7. Grupos

**(a) Sin migración (coste bajo)**
1. Ficha de activo: botón Retirar/Reactivar separado; el actual «Eliminar» (borrado lógico) se oculta hasta (b).
2. Ficha de plan: diálogo Editar (nombre, notas, proveedor, frecuencia) con el aviso de §5. Se habilita solo junto con el cambio de snapshot de §5 (va en el primer paso de b si se requiere RPC) — ver secuencia.
3. Quitar equipo del plan: confirmación provisional; sigue siendo borrado físico hasta (b).
4. Filtros «Mostrar retirados» en Activos.

**(b) Una migración aditiva + servicios (coste medio)**
- Columna `kind` en `mnt_due_changes`; `mnt_sa_plan_months` lee snapshot de sesión.
- Funciones: `mnt_sa_delete_asset`, `mnt_sa_delete_plan`, `mnt_sa_archive_plan`, `mnt_sa_unlink_plan_asset`, `mnt_sa_delete_draft_session`, `mnt_sa_cancel_session`. Cada una: verifica org y permiso con `auth.uid()`, bloquea filas (`FOR UPDATE`), modo `p_confirm=false` devuelve lo que haría, `true` ejecuta; idempotente ante reintento.
- Triggers locales de protección en `documents` e `incidents`; comprobación en la función de archivos.
- Contratos/operaciones, adaptador standalone, servicios, botones en Activo, Plan, Sesión; `install_v1.sql` (sin triggers de documentos/incidencias), spec ICORE y manifest.

**(c) Aplazado**: edición de alcance y plantillas por tipo de plan existente; terminación futura de vínculos; versionado/anulación de cierres; reinicio masivo de datos ficticios; papelera; correctivos, catálogos, asistentes.

## 8. Pruebas de aceptación
1. Retirar/Reactivar activo: fuera/dentro de Próximos y sesiones nuevas; historial intacto.
2. Eliminar activo con solo vínculo nunca usado: desaparece activo y vínculo, sin huérfanos. Con sesión cerrada, documento o certificado: rechazado con motivo.
3. Empleado intenta eliminar activo o plan: rechazado en servidor; otra empresa: rechazado.
4. Plan con 2 borradores vacíos: la confirmación los lista; tras confirmar, plan y borradores eliminados. Borrador con un resultado: plan solo archivable.
5. Cambiar frecuencia de trimestral a anual con sesión abierta: el cierre propone +3 meses; sesión nueva propone +12; fechas programadas intactas.
6. Sesión abierta sin snapshot (fixture SQL): usa frecuencia vigente y muestra el aviso.
7. Desvincular hoy con motivo: no aparece en Próximos ni en sesión nueva hoy; bitácora con `kind='unlink'`, usuario y motivo; historial visible.
8. Eliminar borrador vacío; cancelar en curso con motivo: no avanza fechas; doble llamada no duplica ni falla.
9. Borrar documento o incidencia de sesión cerrada: rechazado (fila y archivo).
10. Suites: vitest, SQL standalone ampliada, instalador ICORE, build; navegador: casos 1, 2, 4, 5, 7, 8.

## 9. Secuencia
1. (a) Retirar/Reactivar activo, filtro retirados, confirmación en quitar equipo. Navegador.
2. (b-1) Migración: snapshot de frecuencia, `kind`, funciones y triggers. Pruebas SQL standalone e instalador. **Sin botones de borrado aún.**
3. (b-2) Editar plan (requiere b-1 para no usar la frecuencia nueva en sesiones abiertas), Desvincular, Cancelar sesión.
4. (b-3) Solo con b-1 validado: botones Eliminar activo, Eliminar plan, Eliminar borrador, Archivar plan.
5. Validación completa, documentación ICORE, roadmap. Parada para revisión.

## 10. Estimación relativa
- (a): baja. (b-1): media (lo más delicado). (b-2)+(b-3): media-baja (UI de diálogos breves).

## 11. Archivos previstos
- UI: `AssetDetailPage`, `AssetsListPage`, `PlanDetailPage`, `PlansListPage`, `SessionDetailPage`, `IncidentDetailPage`, `due-decisions-panel.tsx` (aviso legado).
- Servicios/contratos: `services/assets|plans|sessions.ts`, `contracts/repositories.ts`, `contracts/operations.ts`.
- Adaptador: `repos/assets|plans|sessions.repo.ts`, `adapters/standalone/documents.functions.ts`.
- BD y docs: `drizzle/migrations/0002_mnt_safe_delete.sql`, `sql/install_v1.sql`, `tests/sql/mnt_2a_checks.sql`, `spec/ICORE_ADAPTER_SPEC.md`, `host-manifest.json`, `roadmap.md`.

## 12. Decisiones a confirmar
- D1. Reprogramaciones manuales en bitácora convierten el vínculo en «desvincular» en vez de borrable. Alternativa: permitir borrarlo dejando la bitácora sin vínculo vivo. **Recomendado: D1 tal cual.**
- D2. Auditoría de desvinculación con columna `kind` en `mnt_due_changes`. **Recomendado.**
- D3. Sesiones legado sin snapshot: usar frecuencia vigente con aviso. **Recomendado.**
- D4. Terminación futura de vínculos aplazada. **Recomendado.**
