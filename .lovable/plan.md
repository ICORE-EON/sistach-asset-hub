# Bloque 2A — Edición, desactivación y eliminación controlada (alcance mínimo PYME)

Solo auditoría y plan. No se ha modificado código, esquema ni datos.

## 1. Estado actual confirmado (código + BD)

| Entidad | Ya existe | Observado |
|---|---|---|
| Activo | Editar datos (`updateAsset`), estado `retired`, borrado lógico `softDeleteAsset` (`deleted_at`) desde la ficha | Retirados/borrados ya salen de Próximos y de sesiones nuevas (1B). No hay diferencia en UI entre «Retirar» y «Eliminar»; no existe borrado físico. `maintenance_items.asset_id` es RESTRICT (protege historia); `documents.asset_id` es CASCADE (un borrado físico arrastraría documentos). |
| Plan | Pausar/Reactivar (`setActive`), cambiar plantilla de certificado, añadir equipos, programar fechas | No se puede editar nombre, frecuencia, notas ni proveedor. No hay eliminar ni archivar. FK: borrar plan → CASCADE en vínculos y plantillas por tipo; sesiones quedan con `plan_id` NULL (pierden su plan vivo, el snapshot se conserva). |
| Vínculo plan-activo | `removeAsset` = **DELETE físico** sin confirmación ni motivo | Rompe la regla de trazabilidad: desaparece `next_due_on` y el vínculo. `mnt_due_changes` conserva las filas (append-only, trigger inmutable), pero sin vínculo vivo. Existe `end_on`, ya respetado por Próximos y sesiones, pero no se usa en la UI. |
| Sesión | Estados draft/in_progress/closed/cancelled/reopened; cierre atómico; bloqueo de edición cerrada/cancelada | No hay acción «Cancelar» ni «Eliminar borrador» en UI/servicio. RLS DELETE solo para administrador de empresa; un DELETE arrastraría ítems, respuestas y documentos (CASCADE) y dejaría certificados con session NULL. |
| Resultados de intervención | Editables solo con sesión abierta (`assertItemWritable`) | Correcto. Reapertura ya registrada (`session_reopen_log`). |
| Certificado | Revocar (`revoke`, solo `issued`), editar notas | Sin borrado en UI. Correcto. |
| Documentos | Panel del host; DELETE limitado a administrador | Sin restricción por sesión cerrada: un administrador puede borrar evidencia de un cierre. |
| Incidencia | Editar y **eliminar definitivamente** (con confirm) | Una incidencia ligada a un ítem cerrado puede borrarse. |

Auditoría: triggers `trg_audit_*` activos en activos, planes, vínculos, sesiones, ítems, certificados y documentos; el borrado queda registrado (con la purga temporal ya conocida).

## 2. Política propuesta (recomendada PYME)

- **Retirar / Pausar / Desvincular** = acción habitual, reversible, conserva historia. Sin confirmación compleja; aviso de una línea.
- **Eliminar** = solo cuando no hay evidencia: ninguna sesión cerrada, certificado, documento ni ítem con resultado. Confirmación con nombre del registro. Si hay evidencia, el botón se sustituye por la alternativa (Retirar / Archivar / Cancelar) con explicación.
- La comprobación de «sin evidencias» y el borrado se hacen en una **función de base de datos** con permisos verificados en servidor (nunca solo en la UI).
- Editar un plan **nunca reprograma** fechas existentes: cambiar frecuencia solo afecta a futuras propuestas; se avisa «Las fechas ya programadas no cambian; usa Reprogramar si lo necesitas».

## 3. Tabla de acciones

| Entidad / estado | Acción | Tipo | Permiso | Grupo |
|---|---|---|---|---|
| Activo cualquiera | Editar datos | ya existe | gestionar activos | — |
| Activo | Retirar / Reactivar (status) | botón explícito separado de Eliminar | gestionar activos | a |
| Activo sin evidencias | Eliminar definitivamente | RPC segura | administrador | b |
| Activo con evidencias | Eliminar → bloqueado, propone Retirar | RPC devuelve motivo | — | b |
| Plan | Editar nombre, notas, proveedor, frecuencia | diálogo en ficha | gestionar planes | a |
| Plan | Pausar/Reactivar | ya existe | gestionar planes | — |
| Plan sin sesiones | Eliminar (borra vínculos y plantillas por tipo) | RPC segura | gestionar planes | b |
| Plan con sesiones | Archivar (`status='archived'` + inactivo), oculto por defecto | RPC/servicio | gestionar planes | b |
| Plan | Cambiar alcance / plantilla por tipo | aplazado | — | c |
| Vínculo | Desvincular = `end_on = hoy` + motivo en bitácora | servicio + RPC | gestionar planes | b |
| Vínculo sin historia (nunca en sesión) | Quitar físicamente (corrección de alta) | dentro de la misma RPC | gestionar planes | b |
| Sesión borrador sin resultados | Eliminar borrador | RPC segura | ejecutar mantenimiento | b |
| Sesión borrador/en curso | Cancelar con motivo (estado `cancelled`, no avanza fechas) | RPC | ejecutar mantenimiento | b |
| Sesión cerrada | Sin borrado; corrección = Reabrir (ya existe) / revocar certificado | ya existe | — | — |
| Certificado | Revocar | ya existe | — | — |
| Documento de sesión cerrada / certificado | Bloquear borrado | política RLS | — | b |
| Incidencia ligada a sesión cerrada | Bloquear eliminación; permitir cerrar/cancelar | servicio + RLS | — | b |
| Reinicio de datos de prueba | Script manual revisado, no botón | aplazado | — | c |

## 4. Grupos

**(a) Quick wins sin migración (coste bajo)**
1. Ficha de activo: separar «Retirar» (status `retired`, reversible) de «Eliminar»; aviso claro.
2. Ficha de plan: diálogo «Editar» (nombre, notas, proveedor externo, frecuencia incl. «Cada X años») con aviso de no reprogramación. Reutiliza `FREQUENCIES` y validación de `createPlan`.
3. Confirmación en «Quitar equipo» del plan (provisional hasta b).
4. Filtro «Mostrar retirados» en Activos y «Mostrar archivados» en Planes si hace falta.

**(b) Requieren migración aditiva + servicios (coste medio)** — una sola migración:
- RPC `mnt_sa_delete_asset_if_clean`, `mnt_sa_delete_or_archive_plan`, `mnt_sa_unlink_plan_asset(p_link, p_reason)` (pone `end_on`, registra en `mnt_due_changes` con identidad del servidor; borra físico solo si nunca entró en sesión), `mnt_sa_delete_draft_session`, `mnt_sa_cancel_session(p_session, p_reason)` (guarda motivo en metadata/auditoría).
- Política RLS restrictiva: DELETE en `documents` y `incidents` denegado si la sesión vinculada está cerrada o hay certificado emitido.
- Contratos/operaciones nuevas en `contracts/repositories.ts` y `operations.ts`, adaptador standalone, servicios, botones en Activo, Plan, Sesión.
- Actualizar `install_v1.sql`, spec ICORE y suite SQL.

**(c) Aplazado**
- Editar alcance por centros y plantillas de checklist por tipo de un plan existente (impacta sesiones abiertas).
- Versionado/anulación de cierres firmados; corrección documental formal.
- Reinicio masivo de datos ficticios (en esta fase solo un script SQL revisado manualmente, previa aprobación).
- Papelera/restauración de borrados lógicos.

## 5. Riesgos y dependencias
- CASCADE en `documents` (activo/sesión/ítem) y `maintenance_items` (sesión): cualquier borrado físico debe pasar por las RPC que verifican «sin evidencias»; nunca DELETE directo desde la UI.
- Borrar un plan deja sesiones con `plan_id` NULL: por eso solo se elimina si no tiene sesiones; si las tiene, se archiva.
- Desvincular hoy hace DELETE: cambiarlo a `end_on` mantiene `next_due_on` y bitácora consultables.
- Editar frecuencia con sesiones abiertas: la propuesta de cierre usará la nueva frecuencia; se avisa en el diálogo.
- Portabilidad: todo vía contratos; RPC con prefijo `mnt_sa_` y equivalentes en `install_v1.sql`.

## 6. Pruebas de aceptación
1. Retirar activo: sale de Próximos y de sesión nueva; su historial y certificados siguen visibles; reactivar lo devuelve.
2. Eliminar activo dado de alta por error (sin sesiones/documentos): desaparece; con una sesión cerrada: bloqueado con mensaje y propuesta de Retirar.
3. Editar frecuencia de plan con 5 equipos programados: fechas existentes intactas; siguiente cierre propone con la nueva frecuencia.
4. Eliminar plan de prueba sin sesiones: sin vínculos colgantes. Plan con sesiones: queda archivado, historia intacta.
5. Desvincular equipo con motivo: fuera de Próximos, bitácora con usuario/fecha/motivo, historial conservado.
6. Eliminar borrador vacío; cancelar sesión en curso con motivo: no avanza fechas, aparece como Cancelada.
7. Intentar borrar documento de sesión cerrada o incidencia ligada: denegado en servidor.
8. Rol empleado/auditor: no ve ni puede ejecutar acciones de gestión; otra empresa: denegado.
9. Suites: vitest, SQL app (ampliada), instalador ICORE, typecheck/build; prueba en navegador de los casos 1, 2, 4, 5, 6.

## 7. Estimación relativa
- (a): baja (2–3 cambios de UI, sin migración).
- (b): media (1 migración, 5 RPC, 1–2 políticas, contratos/servicios, 3 pantallas, pruebas SQL).
- (c): no se estima ahora.

## 8. Archivos afectados (previstos)
- UI: `ui/pages/AssetDetailPage.tsx`, `PlanDetailPage.tsx`, `SessionDetailPage.tsx`, `PlansListPage.tsx` (filtro archivados), `AssetsListPage.tsx` (filtro retirados), `IncidentDetailPage.tsx` (ocultar eliminar si ligada).
- Servicios/contratos: `services/assets.ts`, `plans.ts`, `sessions.ts`, `contracts/repositories.ts`, `contracts/operations.ts`.
- Adaptador: `adapters/standalone/repos/assets.repo.ts`, `plans.repo.ts`, `sessions.repo.ts`.
- BD: nueva migración `drizzle/migrations/0002_mnt_safe_delete.sql`; `sql/install_v1.sql`; `tests/sql/` nueva batería; `spec/ICORE_ADAPTER_SPEC.md`, `roadmap.md`.

## 9. Secuencia
1. (a) quick wins y prueba en navegador.
2. (b) migración + RPC + pruebas SQL.
3. (b) contratos/servicios/adaptador + UI de Eliminar/Desvincular/Cancelar.
4. Validación completa y documentación ICORE. Parada para revisión.

## Decisiones para aprobar (recomendación PYME)
- D1: «Eliminar» solo para registros sin evidencias; con evidencias, Retirar/Archivar. **Recomendado.**
- D2: Desvincular por `end_on` + motivo, no borrado físico (salvo vínculo nunca usado). **Recomendado.**
- D3: Eliminar activo/plan solo administrador; desvincular/archivar plan con permiso de gestionar planes; borrar borrador/cancelar con permiso de ejecutar. **Recomendado.**
- D4: Editar frecuencia permitido sin reprogramar fechas existentes. **Recomendado.**
