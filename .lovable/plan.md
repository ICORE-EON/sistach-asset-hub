# Bloque 2B — Mantenimiento correctivo sencillo (plan, sin implementar)

## 1. Qué existe y se reutiliza (verificado en esquema y contratos)

| Pieza | Estado actual | Uso en 2B |
|---|---|---|
| `maintenance_sessions` | `plan_id` ya admite vacío; `is_external`, `external_provider`, `external_cert_number`, `technician_id/name`, `notes`, `outcome`, `metadata`; estados `draft/in_progress/closed/reopened/cancelled` | Base del correctivo (sin tabla paralela) |
| `maintenance_items` | Una fila por activo con `result`, `observations`, `completed_at` | Un ítem = el equipo reparado |
| Sesiones «ad-hoc» | La UI ya muestra «Sesión ad-hoc» cuando no hay plan (lista, detalle, Histórico, ficha) | Se sustituye por la etiqueta «Correctivo» |
| Cancelación 2A (`mnt_sa_cancel_session`) | Pide motivo, idempotente, no mueve fechas | Igual para correctivos |
| Borrador vacío 2A | Borrado solo si no hay trabajo | Igual |
| Guardas 2A | Evidencias, cierres e incidencias ligadas protegidas | Cubren correctivos sin cambios |
| `incidents` | `asset_id`, gravedad, estado, `source_maintenance_item_id` | Vínculo opcional; no se duplica |
| Adjuntos del host (`AttachmentsPanel` / DocumentPort) | Ligado a sesión | Evidencias del correctivo |
| Estado de activo | Ya existe `out_of_service` | «Averiado» = `out_of_service`, sin estado nuevo |
| Personas / permisos / organización | PeoplePort, `can_run_maintenance`, `can_manage_*`, contexto org explícito | Responsable y permisos |
| `listAssetHistory` y Histórico | Leen sesiones e ítems | Mostrarán correctivos con etiqueta |

**Carencias:**
- No hay un tipo de intervención que distinga preventivo y correctivo.
- Faltan fecha de detección, prioridad y descripción de la avería.
- No hay forma de vincular el correctivo a una incidencia desde la sesión.
- No hay registro de actuaciones sucesivas.
- No hay un cierre correctivo que garantice no tocar fechas preventivas.
- No hay lista de correctivos abiertos.
- En el instalador ICORE, `mnt_sessions.plan_id` es obligatorio.

**Pendiente de verificar en la etapa 1:** si Próximos excluye hoy los equipos `out_of_service`. Si los excluye, se corrige para que sigan visibles.

## 2. Modelo mínimo recomendado: ampliar sesiones, no crear una tabla nueva de órdenes

Se añaden columnas a `maintenance_sessions` (migración aditiva):
- `kind` text: `preventive` (por defecto) o `corrective`. Restricción: si es `preventive`, el plan es obligatorio; si es `corrective`, el plan queda vacío.
- `detected_on` date, `priority` (`low/normal/high`), `fault_description` text: obligatorios solo si es correctivo.
- `incident_id` uuid, opcional, de la misma organización (se comprueba en un trigger, como en 2A).

Además, una tabla pequeña de actuaciones, `mnt_session_entries`: sesión, organización, fecha, texto, autor y copia del autor. Solo admite añadir filas; no se editan ni se borran (mismo patrón que la bitácora 1B).
- **Alternativa más barata:** usar solo `notes`. Pierde trazabilidad. La propongo como opción A en las decisiones.

**Cierre:** nueva función `mnt_sa_close_corrective(org, sesión, fecha real, resultado, observaciones)`. Es atómica e idempotente, con resultado `repaired`, `not_repaired` o `replaced`.
- Ese resultado se guarda en `outcome`, ampliando su lista de valores.
- La función **nunca llama** a la lógica de vencimientos y no escribe en `mnt_due_changes`.

**Por qué es la opción más simple y segura:**
- Reutiliza estados, cancelación, guardas 2A, adjuntos, Histórico, permisos y aislamiento por empresa. No hay un segundo circuito de evidencias que proteger.
- **Seguridad:** las mismas políticas por `company_id`; el cierre y la cancelación se hacen por función con comprobación de permiso.
- **ICORE:** en el instalador, `plan_id` pasa a admitir vacío con la misma restricción por tipo. Se añaden las mismas columnas, la tabla de entradas y la función de cierre. Se suman pruebas al instalador y se documentan en la especificación y el manifiesto.
- **Auditoría:** el trigger de auditoría actual y la tabla de entradas, que solo admite añadir filas.

## 3. Flujos

```text
Ficha activo / Incidencia ──► «Nueva reparación» (diálogo corto)
   └─ estado in_progress ─► añadir actuaciones + adjuntos ─► Cerrar (fecha real, resultado, observaciones)
                         └─ Cancelar con motivo (2A)
```

- **Interno:** el responsable es una persona de la organización y añade actuaciones. Cierra con firma simple, que reutiliza el nombre y el cargo del firmante.
- **Externo:** se marca «Empresa externa» y se indican el proveedor y la referencia del parte. Se adjunta el informe; recomiendo que el adjunto no sea obligatorio (decisión D3).
- **Incidencia de calidad/ISO:** es opcional. Desde una incidencia con equipo se puede crear la reparación ya vinculada. Desde el correctivo se puede vincular una incidencia existente o «crear incidencia» con el formulario actual. Una reparación no abre ninguna incidencia automáticamente.
- **Estado del equipo:** en el alta, la casilla «Marcar equipo como averiado» lo pone en `out_of_service`. Al cerrar como «Reparado», se ofrece «Volver a activo». Nada de esto se hace en silencio.
- **Preventivo:** al cerrar, si la reparación incluyó una revisión, solo se muestra el aviso «Registra la revisión preventiva en su plan». Las fechas no se modifican. Los dos flujos se mantienen separados.

**Ejemplos:**
- **Extintor EXT-07 con el manómetro en rojo:** se crea desde la ficha con prioridad alta y se marca como averiado. Interviene una empresa externa (Proveedor X), que adjunta el parte de recarga. Se cierra como «Reemplazado» o «Reparado» y se vuelve a activo. El preventivo anual del extintor no cambia.
- **Climatizador CL-02 que no enfría:** lo detecta mantenimiento interno y hay una incidencia ISO abierta por un cliente, así que se crea desde esa incidencia. Se registran dos actuaciones (diagnóstico y cambio de condensador). Se cierra como «Reparado» y la incidencia se cierra en su propio módulo.

## 4. Permisos e impacto en pantallas

| Acción | Permiso |
|---|---|
| Crear, añadir actuación, cerrar | `can_run_maintenance` |
| Cancelar o borrar un borrador vacío | Igual que en 2A |
| Cambiar el estado del equipo | `can_manage_assets` |
| Vincular una incidencia | `can_run_maintenance`, más la comprobación de la misma organización |

- **Ficha de activo:** botón «Nueva reparación», aviso «X correctivos abiertos» e Histórico con la etiqueta Preventivo/Correctivo.
- **Mantenimientos:** nueva pestaña «Correctivos» con los abiertos primero, filtro de estado y orden por prioridad y fecha de detección. Reutiliza el detalle de sesión con una cabecera adaptada.
- **Próximos:** sin cambios. Los correctivos no aparecen y los equipos averiados siguen visibles.
- **Incidencia:** la sección «Reparaciones vinculadas» muestra solo una lista con enlaces.

## 5. Entregas por etapas

1. **Esquema y seguridad (media):** migración aditiva, trigger de organización para la incidencia, tabla de entradas que solo admite añadir filas y función de cierre correctivo. Pruebas SQL con roles, aislamiento, no tocar vencimientos, idempotencia y cancelación. El instalador ICORE recibe los mismos cambios y sus pruebas.
2. **Contratos, servicios y repositorio (baja):** `createCorrective`, `addEntry`, `closeCorrective` y `listOpenCorrectives`, con el contexto de organización explícito, más pruebas de propagación de organización.
3. **Pantallas (media):** diálogo de alta, cabecera y cierre en el detalle, pestaña Correctivos y botón en la ficha y en la incidencia.
4. **Validación (baja):** Vitest, build y E2E en Sistach con datos TEST para los dos ejemplos. Se toman huellas antes y después, filtradas por organización y guardando el SQL. Se actualizan la especificación, el manifiesto y el roadmap.

**Aceptación:**
- Crear un correctivo sin plan.
- Comprobar que no cambia `next_due_on` y que no se escribe en la bitácora de fechas.
- Comprobar que no se puede editar después del cierre.
- Comprobar que otra organización recibe un rechazo.
- Comprobar que un equipo averiado sigue en Próximos.

## 6. Decisiones necesarias

- **D1:** actuaciones en una tabla de entradas que solo admite añadir filas (recomendado) o solo en notas (más barato, menos trazable).
- **D2:** resultados `repaired`, `not_repaired` y `replaced`, ¿o solo «Reparado / No reparado»?
- **D3:** ¿adjunto obligatorio en correctivo externo? Recomiendo que no.
- **D4:** prioridad de tres niveles (`low/normal/high`), ¿de acuerdo?
- **D5:** ¿se permite reabrir un correctivo cerrado? Recomiendo aplazarlo y usar uno nuevo vinculado.

## Aplazado

Repuestos, costes, SLA, planificación de técnicos, notificaciones, varios equipos por correctivo, reapertura, informe PDF del correctivo y cierre combinado con el preventivo.
