# Bloque 1B (revisado) — Vencimientos con control del usuario

Solo planificación. El diagnóstico anterior sigue siendo válido (skipped y "no aplica" reinician el ciclo usando `closed_at`; `start_on + intervalo` como primera fecha; desbordes de fin de mes con `setMonth`; mezcla UTC/local; activos retirados sin excluir; truncado silencioso a partir de 1000 filas; `createSession` sin filtrar vínculos ni activos). Esta revisión cambia la solución: **la próxima fecha pasa a ser un dato guardado por equipo y plan**, que el sistema propone y el usuario puede corregir, en lugar de recalcularse cada vez.

## 1. Reglas de negocio

Tres conceptos separados, **por equipo** (nunca solo por sesión):
- **Ejecución**: si se hizo o no la revisión del equipo.
- **Resultado**: conforme o con incidencias.
- **Seguimiento**: las incidencias siguen su circuito actual. No hay motor nuevo.

| Situación del equipo al cerrar | Ejecución | ¿Avanza el ciclo? | Interacción |
|---|---|---|---|
| Conforme (`ok`) | Realizada | Sí, con la fecha propuesta | Ninguna |
| Con incidencias (`with_incident`, `failed` externo) | Realizada | Sí por defecto | Ninguna; el usuario puede pulsar "No avanzar" y debe dar un motivo |
| Omitido (`skipped` o pendiente al cerrar) | No realizada | No. Sigue con su fecha prevista (y saldrá vencido) | Ninguna. Nunca cuenta como hecho |
| "No aplica" global del equipo (`not_applicable`) | No realizada | **Solo si el usuario lo decide** | Pregunta obligatoria "¿Programar el siguiente mantenimiento?" con motivo. Si dice sí, es una **exención justificada** del ciclo |
| Puntos del checklist marcados "no aplica" | No afecta | Según el resultado del equipo | Ninguna |
| Sesión cancelada | — | No | Ninguna |

Pregunta "¿Programar el siguiente mantenimiento?": aparece solo en casos excepcionales: equipos con "No aplica" global o cuando el usuario elige "No avanzar" o "Cambiar fecha". El cierre normal conforme no añade pasos.

Exención de un omitido (no toca hacerlo este ciclo): se hace desde Próximos con la acción "Reprogramar" sobre ese equipo (con motivo obligatorio). Así queda constancia sin fingir una revisión.

## 2. Regla de propuesta (determinista, sin dos motores)

Datos: `P` = fecha prevista del ciclo, `E` = fecha efectiva de la revisión (día calendario), `I` = intervalo en meses, `T` = margen = mín(30 días, I × 30 / 6), es decir, una sexta parte del intervalo, con un máximo de 30 días.

- Si `|E − P| ≤ T` → propuesta = `P + I` (se respeta el calendario y no hay deriva por adelantarse o retrasarse unos días).
- Si no, o si no hay `P` → propuesta = `E + I` (se adopta el nuevo ritmo real tras un retraso o adelanto grande).

Por qué: con una única regla se evita que el calendario se desplace un poco en cada ciclo (deriva) y, a la vez, no se encadenan vencimientos imposibles tras un retraso grande. El usuario puede corregir siempre la fecha.

Aritmética: fechas calendario `YYYY-MM-DD`; sumar meses recortando al último día del mes (31-ene + 1 = 28/29-feb; 29-feb + 12 = 28-feb). La fecha efectiva de un cierre interno se convierte al día local de la organización (Europe/Madrid en esta app; en ICORE, la zona horaria de la organización la aporta el host).

## 3. Primer vencimiento

Al asignar equipos a un plan (crear plan, "Añadir equipos" y, más adelante, desde el alta del activo), se elige una opción en un único selector para todo el lote, editable por equipo:
1. **Próxima fecha prevista**: se indica directamente.
2. **Última revisión**: se indica la fecha y se propone `última + I` (editable).
3. **Sin programar**: aparece en Próximos como "Sin programar" y no se marca como vencido.

`start_on` mantiene su significado (inicio del vínculo) y **no** se usa como vencimiento. Ejemplo del extintor trasladado: última revisión en enero → propuesta en abril → el responsable la cambia a mayo indicando el motivo → queda registrado.

## 4. Almacenamiento mínimo necesario

Comprobado: `audit_logs` existe, pero ninguna tabla de mantenimiento tiene el disparador de auditoría y tiene purga por antigüedad (`audit_logs_purge_old`). Por eso no sirve como evidencia permanente de cambios de fecha. `maintenance_plan_assets` no tiene campo de vencimiento. `maintenance_items.metadata` ya guarda instantáneas.

Propuesta (una migración aditiva, sin tocar datos):
- `maintenance_plan_assets`: añadir `next_due_on date null` (null = sin programar), `last_done_on date null` y `due_updated_at timestamptz null`. Es el **estado actual** y se lee rápido.
- Nueva tabla `mnt_due_changes` (solo inserción, RLS por `company_id`, sin FK a auth.users, `person_ref uuid`): `plan_asset_id`, `item_id null`, `old_due date null`, `new_due date null`, `source` (`initial | proposal | manual | exemption | no_advance`), `reason text null` (obligatorio en manual, exención y no avanzar), `created_at`. Es la **bitácora**.
- `maintenance_items.metadata.due` (sin columna nueva): `{ planned_on, effective_on, proposed_on, applied_on, advanced }`, congelado al cerrar junto al `close_snapshot` actual. Esto conserva la fecha prevista y la efectiva de cada ejecución sin sobrescribir el historial.
- Una función `mnt_apply_due_changes(session, decisiones)` con `SECURITY DEFINER`, en una sola transacción: actualiza `next_due_on` solo si sigue siendo la fecha leída (control de concurrencia) e inserta en la bitácora. Se ejecuta al cerrar (interno y externo) y al reprogramar.

Alternativas descartadas: solo metadata (la bitácora quedaría dispersa y no se puede consultar), `audit_logs` (purga y semántica genérica) o seguir calculando al vuelo (no permite corregir la fecha).

Datos existentes (de prueba): un relleno inicial en la misma migración rellena `next_due_on` con la regla nueva a partir de la última ejecución realizada; los vínculos sin historial quedan sin programar. Se registra con `source='initial'`.

## 5. Flujo con 50 extintores (47 realizados y 3 omitidos)

Al pulsar "Cerrar y firmar" no hay preguntas: los 47 avanzan con la propuesta y los 3 omitidos mantienen su fecha (saldrán vencidos en Próximos). Solo si hay equipos con "No aplica" global aparece un paso "Revisar programación" que lista **solo esos equipos**. Ese paso permite marcar todos a la vez y escribir un motivo común. Para corregir fechas de forma excepcional, en ese mismo paso hay un enlace opcional "Ajustar fechas" que permite cambiarlas por equipo o en bloque.

Registro externo: igual, con un único resultado para todos y avance de todos por defecto.

## 6. Componentes afectados

- Dominio (portable): `domain/due-date.ts` con `addMonthsClamped`, `toOrgDate`, `proposeNextDue(P, E, I)`, `isExecution(result)` y `defaultAdvance(result)`, más pruebas.
- Contratos: `UpcomingRow` añade `scheduled`, `last_result` y `plan_asset_id`. Nuevas operaciones `sessions.applyDueDecisions` y `plans.rescheduleAsset({planAssetId, newDue, reason})`, y la opción de primer vencimiento en `createPlan`/`addAssets`. Todo con `orgId` explícito; se documenta en `spec/` (ICORE_ADAPTER_SPEC, DTO_MAPPING, operations).
- Adaptador standalone: `listUpcoming` lee `next_due_on` (sin recalcular), excluye activos retirados o borrados (no los averiados ni los que están en mantenimiento) y vínculos con `end_on` pasado, y pagina por bloques. `closeSession`/`recordExternal` llaman a la función atómica. `createSession` filtra vínculos vigentes y activos no retirados. `plans.repo` acepta el primer vencimiento.
- UI: Próximos del Bloque 1A añade la acción "Reprogramar" por equipo en el diálogo "Ver equipos", el estado "Sin programar" y una marca discreta de "última con incidencias". La agrupación plan + fecha funciona igual y es más estable porque las fechas ya están guardadas. Planes: selector de primer vencimiento en crear y añadir equipos. Sesión: paso "Revisar programación" condicional.
- Histórico: sin cambios (sigue ordenado por fecha administrativa y paginado en servidor).

## 7. Casos límite y pruebas de aceptación

- 31-ene + 1 mes, 29-feb + 12 meses, 30-nov + 3 meses, intervalo de 60 meses.
- Cierre a las 23:30 de Madrid = ese mismo día; a las 00:30 = el día siguiente.
- Regla de propuesta: revisión 10 días tarde dentro del margen → `P + I`; 4 meses tarde → `E + I`; sin `P` → `E + I`.
- 50 equipos: 47 conformes y 3 omitidos → 47 avanzan, 3 conservan la fecha, 0 preguntas y 47 entradas en la bitácora con `source='proposal'`.
- Con incidencias: avanza por defecto; "No avanzar" sin motivo se rechaza.
- "No aplica" global: sin decisión no se puede cerrar; si se avanza, queda como `exemption` con motivo.
- Reprogramación manual: exige motivo; guarda la fecha anterior y la nueva; el historial de la ejecución no cambia.
- Dos cierres simultáneos de la misma fecha: solo uno aplica y el otro no la sobrescribe.
- Primer vencimiento: fecha directa, desde última revisión o sin programar; `start_on` futuro no altera la fecha.
- Activo retirado: desaparece de Próximos y sigue en Histórico. Activo averiado: sigue apareciendo.
- Más de 1500 vínculos (en base desechable): sin truncado.
- Otra organización no ve ni modifica fechas ni bitácora (RLS y función).

## 8. Portabilidad e ICORE

Reglas en `domain/`; persistencia con tablas `mnt_` y columnas en tablas propias del módulo; la zona horaria la aporta el host (TenantPort `timezone`, opcional). Se añade al instalador limpio `install_v1.sql` y a sus pruebas en PostgreSQL desechable. Sin dependencias standalone en las capas exportables.

## 9. Secuencia y complejidad

| Entrega | Contenido | Complejidad |
|---|---|---|
| 1B-1 | Dominio de fechas y propuesta, con pruebas | Baja |
| 1B-2 | Migración aditiva, función atómica, relleno inicial, instalador limpio y pruebas SQL | Media |
| 1B-3 | Adaptador: `listUpcoming` sobre `next_due_on`, exclusiones, paginación, `createSession` filtrado | Media |
| 1B-4 | Cierre interno y externo con avance por equipo y paso condicional | Media |
| 1B-5 | Reprogramar desde Próximos y primer vencimiento en Planes | Baja-Media |

## 10. Decisiones imprescindibles antes de aprobar

1. Margen anti-deriva: ¿aceptáis 1/6 del intervalo con un máximo de 30 días?
2. ¿Quién puede reprogramar? Propuesta: los mismos que pueden gestionar planes (`can_manage_assets`).
3. ¿El relleno inicial de los datos de prueba se aplica así o preferís dejar todos los vínculos sin programar?
