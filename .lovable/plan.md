# Bloque 2B — Mantenimiento correctivo sencillo (plan rev. 2, sin implementar)

Enfoque aprobado:
- Se reutilizan `maintenance_sessions` y sus ítems, separando por `kind`.
- Un correctivo no tiene plan.
- Las actuaciones van en una tabla mínima donde solo se añaden filas.
- Se reutilizan los adjuntos, los permisos y la cancelación del Bloque 2A.
- Las fechas del preventivo nunca cambian automáticamente.

Decisiones:
- **D1:** tabla de actuaciones donde solo se añaden filas.
- **D2:** resultados Reparado / No reparado / Sustituido.
- **D3:** adjunto externo opcional.
- **D4:** prioridad baja / normal / alta.
- **D5:** reapertura aplazada.

## 1. Lo que hay hoy y se reutiliza (verificado)

| Pieza | Estado | Uso en 2B |
|---|---|---|
| `maintenance_sessions` | `plan_id` puede ir vacío. Tiene `is_external`, proveedor y referencia, `technician_*`, `notes`, `outcome`, `metadata`, `created_by` y `closed_at`. Estados: `draft/in_progress/closed/reopened/cancelled` | Base del correctivo |
| `maintenance_items` | Una fila por activo, con `result`, `observations`, `completed_at` y `completed_by` | El equipo reparado |
| Etiqueta «Sesión ad-hoc» | Aparece en la lista, el detalle, el Histórico y la ficha cuando no hay plan | Se mantiene para lo heredado |
| Cancelación y borrador vacío 2A | Funciones con motivo, idempotentes y sin tocar fechas | Igual en correctivos |
| Protecciones 2A | Evidencias, cierres e incidencias ligadas | Sin cambios |
| `incidents` | `asset_id`, gravedad, estado, alta manual | Vínculo opcional |
| Adjuntos del host | Ligados a la sesión | Evidencias |
| Estado del activo | Ya existe `out_of_service` | Significa «Averiado» |

**Inventario de sesiones sin plan (consulta del 2026-10-25):** hay **0 filas** con `plan_id` vacío en todas las organizaciones. No existe ningún dato antiguo que clasificar. Aun así, el diseño debe ser compatible con sesiones sin plan que puedan existir (`kind = 'legacy'`, ver sección 2).

## 2. Modelo exacto

Migración aditiva sobre `maintenance_sessions`. No borra nada ni reclasifica nada.
- `kind` text NOT NULL DEFAULT `'preventive'`, con valores `preventive`, `corrective` y `legacy`.
  - En la misma migración, toda fila sin plan se marca `legacy`. Hoy son 0 filas, pero se hace igual por seguridad.
  - Nunca se convierte una sesión antigua en `corrective`.
- Restricciones:
  - `kind='corrective'` exige `plan_id IS NULL`.
  - `kind='preventive'` exige `plan_id IS NOT NULL`. Esta se añade `NOT VALID` y se valida después del paso anterior, para que no pueda fallar con datos antiguos.
  - `legacy` no impone ninguna condición.
- Columnas nuevas, opcionales (NULL), obligatorias solo si el tipo es correctivo (restricción CHECK):
  - `detected_on` date
  - `priority` (`low/normal/high`)
  - `fault_description` text
- `incident_id` uuid, opcional. Un trigger exige que la incidencia sea de la misma organización y tenga el mismo activo o ninguno.
- `outcome`: se añaden los valores `repaired`, `not_repaired` y `replaced`, válidos solo con `kind='corrective'`.

**Tres fechas distintas, sin columnas repetidas:**
- **Detección:** `detected_on` (nueva).
- **Ejecución real:** `maintenance_items.completed_at` del ítem del equipo. Ya existe y admite fechas pasadas, así que la fecha de un trabajo externo puede ser retroactiva (no anterior a la detección ni futura).
- **Cierre administrativo:** `closed_at` (ya existe), la pone el servidor.

**Tabla nueva `mnt_session_entries`:**
- Columnas: `id`, `company_id`, `session_id`, `performed_on`, `text`, `author_id` y copia del nombre del autor.
- Lleva sus permisos de acceso, protección por organización y lectura según `can_view`.
- Solo se añaden filas, mediante una función, y únicamente si la sesión es correctiva y está abierta. Un trigger impide modificarlas o borrarlas.

**Funciones nuevas** (se ejecutan con permisos propios y comprueban organización y permiso):
- `mnt_sa_create_corrective(org, asset, detected_on, priority, description, incident?, external?, provider?, mark_out_of_service bool)`
  - Crea la sesión `in_progress` y un ítem para el equipo, en una sola operación.
  - Solo cambia el estado del equipo si se pide y quien lo pide puede gestionar activos.
- `mnt_sa_add_entry(org, session, performed_on, text)`
- `mnt_sa_close_corrective(org, session, performed_on, outcome, observations, provider?, reference?)`
  - Es idempotente.
  - Guarda el autor autenticado y su nombre.
  - No exige firma gráfica ni certificado. La firma es opcional.
  - **No llama** a la lógica de vencimientos ni escribe en `mnt_due_changes`.

**Separación de los cierres preventivos:**
- `mnt_sa_close_session`, `mnt_sa_record_external` y la emisión de certificados pasan a rechazar `kind <> 'preventive'`.
- La primera tarea de la etapa 1 es revisar sus condiciones actuales. Sin plan ya no deberían aplicar fechas, pero se confirma con una prueba.
- La cancelación y el borrado de borrador de 2A se aplican sin cambios a los tres tipos.

**ICORE:**
- En `mnt_sessions.plan_id` se quita el NOT NULL. Se añaden `kind` y las mismas restricciones, la tabla `mnt_session_entries` y las funciones `mnt_create_corrective`, `mnt_add_entry` y `mnt_close_corrective`, con los permisos `mnt.run` / `mnt.manage_assets`.
- Quitar ese NOT NULL es compatible: en una instalación limpia no hay filas, y en una reinstalación todas tienen plan, así que quedan como `preventive`.
- `mnt_close_session` rechaza los correctivos.
- La incidencia es del host: `incident_ref` se valida con un contrato del host en lugar de una relación fija entre tablas.

## 3. Estados y etiquetas

| Interno | Etiqueta |
|---|---|
| `draft` | Pendiente |
| `in_progress` / `reopened` | En reparación |
| `closed` | Finalizada |
| `cancelled` | Cancelada |

El estado de la intervención y el estado operativo del equipo se muestran por separado («Equipo: Averiado / Activo»).

**Reglas al cerrar** (siempre propuestas explícitas, nunca cambios en silencio):
- **Reparado:** se ofrece «Volver a activo», solo visible para quien puede gestionar activos.
- **No reparado:** la intervención se cierra y el equipo sigue fuera de servicio. No hay opción de reactivarlo.
- **Sustituido:** no se toca la identidad del activo original. Se proponen dos acciones opcionales: «Retirar equipo antiguo» (que usa la acción de 2A) y «Dar de alta equipo nuevo» (abre el formulario actual).
- Los equipos averiados **siempre siguen en Próximos**. En la etapa 1 se comprueba la condición actual; si hoy excluye `out_of_service`, se corrige.

## 4. Flujos

```text
Ficha activo / Incidencia ─► «Nueva reparación» (descripción, detección, prioridad, ¿externa?, ¿marcar averiado?)
  ─► En reparación ─► + actuación (fecha, texto) / + adjunto
  ─► Finalizar (fecha real, resultado, observaciones, proveedor/ref. si externa) ─► propuesta de estado del equipo
  └► Cancelar con motivo (2A)
```

- **Interno:** el responsable es una persona de la organización y el cierre registra al usuario autenticado.
- **Externo:** proveedor y referencia; la fecha real puede ser anterior y el adjunto es opcional.
- **Incidencia ISO:** opcional.
  - Desde la ficha se crea sin incidencia.
  - Desde una incidencia, la reparación se crea ya vinculada.
  - En el detalle hay «Vincular incidencia existente» (de la misma organización) o «Crear incidencia», que usa el alta del host.
  - Nunca se abre una incidencia ni una no conformidad automáticamente.
- **Preventivo:** al cerrar solo se muestra el aviso «Si se hizo la revisión periódica, regístrala en su plan». Las fechas no cambian.

**Ejemplos:**
- **Extintor EXT-07** con presión baja: reparación desde la ficha, prioridad alta, se marca como averiado. Lo atiende una empresa externa que hizo la recarga el día 3 y se registra el día 5 con fecha real 3. Resultado «Reparado» y se acepta «Volver a activo». El preventivo anual no cambia.
- **Climatizador CL-02** que no enfría: se crea desde una incidencia ISO existente. Actuaciones «Diagnóstico» y «Pedido de compresor». Resultado «No reparado» y sigue fuera de servicio. Más adelante se abre un correctivo nuevo vinculado, sin reapertura.

## 5. Permisos

| Acción | Permiso (en el servidor) |
|---|---|
| Crear, añadir actuación, finalizar, vincular incidencia | `can_run_maintenance` |
| Cancelar o borrar un borrador vacío | Igual que en 2A |
| Marcar averiado o volver a activo | `can_manage_assets` |
| Retirar o dar de alta un equipo | Acciones actuales de activos |

## 6. Impacto en pantallas

- **Ficha de activo:** botón «Nueva reparación», aviso de correctivos abiertos y en el Histórico la etiqueta Preventivo / Correctivo / Ad-hoc.
- **Mantenimientos:** nueva pestaña «Reparaciones» con las abiertas primero, filtro de estado y orden por prioridad y detección.
- **Detalle de sesión:** cabecera y cierre propios del correctivo, en el mismo componente.
- **Próximos:** sin cambios; los correctivos no aparecen y los equipos averiados siguen visibles.
- **Incidencia:** lista «Reparaciones vinculadas».

## 7. Aceptación

**SQL (app y suite temporal ICORE):**
- La migración no reclasifica filas; las que no tienen plan quedan como `legacy`.
- Un preventivo sin plan se rechaza; un correctivo con plan se rechaza.
- El cierre correctivo no cambia `next_due_on` y no escribe en `mnt_due_changes`. Es idempotente.
- El cierre preventivo, el registro externo y el certificado rechazan los correctivos.
- Las actuaciones no se pueden modificar ni borrar, y se rechazan si la sesión está cerrada.
- Una incidencia de otra organización se rechaza.
- Un usuario sin permiso o de otra organización recibe un rechazo (42501).
- Cambiar el estado del equipo sin `can_manage_assets` se rechaza.
- La fecha real no puede ser futura ni anterior a la detección.
- La cancelación 2A funciona sobre un correctivo.

**E2E en Sistach con datos TEST (2–3 equipos):**
- Los dos ejemplos de la sección 4.
- Un equipo averiado sigue en Próximos.
- Huellas por organización antes y después, guardando el SQL usado.
- Limpieza de los datos TEST.

**Vitest:** contratos, propagación de organización y reglas de resultado → propuesta de estado del equipo.

## 8. Etapas

1. **Esquema y seguridad (media):** revisar las condiciones de Próximos y de los cierres preventivos, migración aditiva, funciones, triggers y pruebas SQL. Mismos cambios en el instalador ICORE y su suite.
2. **Contratos, servicios y repositorio (baja):** `createCorrective`, `addEntry`, `closeCorrective`, `listCorrectives` y `linkIncident`.
3. **Pantallas (media):** diálogo de alta, detalle y cierre, pestaña Reparaciones y accesos desde la ficha y la incidencia.
4. **Validación y documentación (baja):** Vitest, build, E2E, especificación ICORE, manifiesto y roadmap.

## 9. Riesgos para datos antiguos

- Hacer obligatorio el plan en preventivos sin clasificar antes las filas existentes rompería la migración. Se evita con `legacy` + `NOT VALID` + validación posterior. Hoy hay 0 filas afectadas.
- Ampliar los valores de `outcome` no afecta a las filas existentes.
- En ICORE, quitar el NOT NULL de `plan_id` es una relajación y no invalida datos.

## Aplazado

Repuestos, costes, SLA, planificación de técnicos, notificaciones, PDF del correctivo, cierre combinado con el preventivo, reapertura y varios equipos por reparación.
