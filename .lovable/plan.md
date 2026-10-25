# Bloque 1B (versión final) — Vencimientos sencillos para pyme

Solo es un plan. El diagnóstico ya está aceptado y no se repite. Principio: con pocos equipos (por ejemplo, 5 extintores, 2 climatizadores y un compresor) se debe poder programar, registrar y consultar en pocos pasos. La integridad, los permisos y la trazabilidad no se recortan.

## 1. Qué cambia respecto a la versión anterior (simplificación)

- Se elimina el margen anti-deriva (1/6 del intervalo, con un máximo de 30 días).
- Se elimina la tabla de bitácora con varios tipos de origen y el relleno inicial con fechas calculadas.
- Se elimina el paso "Revisar programación" como pantalla aparte: se sustituye por una línea editable en el diálogo de cierre ya existente.
- Se mantiene el resto: la próxima fecha queda guardada por equipo y plan, se puede corregir y cada cambio queda registrado.

## 2. Regla de fecha propuesta (una sola)

**Propuesta = fecha real de la revisión + intervalo del plan.**

- Es fácil de explicar ("la siguiente vence un periodo después de la que se ha hecho") y nunca esconde un retraso: si se revisa tarde, la fecha prevista original sigue registrada y la diferencia se ve.
- **Mantener el calendario**: en el cierre, si había fecha prevista y no coincide con la propuesta, aparece un único botón alternativo, "Mantener calendario (prevista + intervalo)". Es solo otro valor sugerido para la misma casilla, no un segundo motor ni un ajuste del plan.
- El responsable puede aceptar la propuesta, elegir la alternativa o escribir otra fecha.
- Una fecha corregida no significa que se haya cumplido una norma. Si la revisión se hizo después de la fecha prevista, el equipo se marca como "Realizado con retraso" en su historial.

Aritmética: fechas de calendario (día, sin hora). Al sumar meses, si el día no existe se usa el último día del mes (31-ene + 1 = 28/29-feb; 29-feb + 12 = 28-feb). La fecha real de una revisión interna es el día local de la organización: Europe/Madrid en esta app; en ICORE, la zona horaria la aporta el host. La fecha real de una revisión externa es la `performed_on` indicada.

## 3. Reglas por equipo al cerrar

| Resultado del equipo | ¿Se hizo? | Próxima fecha por defecto | ¿Hay que hacer algo? |
|---|---|---|---|
| Conforme | Sí | Se aplica la propuesta | No |
| Con incidencias | Sí | Se aplica la propuesta | No. Opción "No avanzar" con motivo obligatorio |
| Omitido o pendiente | No | No cambia (si ya ha pasado, sale vencido) | No |
| "No aplica" global del equipo | No | No cambia | Sí: elegir "Mantener fecha" o "Exención: programar siguiente" (motivo obligatorio) |
| Puntos del checklist "no aplica" | — | Según el resultado del equipo | No |

Varios equipos: el resultado común se aplica a todos y solo se tocan las excepciones. Esto vale para revisiones internas y externas. En el registro externo se añade "Excepciones por equipo": por defecto todos tienen el resultado común y se pueden marcar 2 de 50 como "Con incidencias" u "Omitido". Nunca se piden 50 confirmaciones.

## 4. Primera fecha al vincular un equipo a un plan

Al crear el plan, al añadir equipos o al dar de alta el activo, un único selector para el lote:
1. **Fecha prevista**: se escribe directamente.
2. **Última revisión**: se escribe la fecha y se propone última + intervalo, editable.
3. **Sin programar** (por defecto).

`start_on` conserva su significado de inicio del vínculo y no se usa como vencimiento.

## 5. Almacenamiento mínimo

Una migración aditiva:
- `maintenance_plan_assets.next_due_on date null`: próxima fecha actual, `null` = sin programar.
- Nueva tabla `mnt_due_changes`, de solo inserción: `company_id`, `plan_asset_id`, `session_id null`, `old_due`, `new_due`, `reason null`, `changed_by` (siempre `auth.uid()`, asignado en el servidor) y `changed_at`. RLS de lectura por organización, sin escritura directa (solo mediante funciones). Sin FK a auth.users, igual que el resto del módulo.
- En `maintenance_items.metadata.due` (sin columna nueva), congelado al cerrar: `planned_on` (fecha prevista antes de ejecutar), `executed_on`, `late` y `applied_due`. El pasado nunca se sobrescribe.

Por qué no basta con lo que ya existe: no hay ningún campo de vencimiento, y `audit_logs` purga los registros antiguos y no se usa en las tablas de mantenimiento. Guardarlo solo en metadata no permitiría corregir ni consultar las fechas.

Datos actuales (de prueba): todos los vínculos quedan **sin programar**. No se generan fechas y el historial no se toca.

## 6. Cierre atómico e idempotente

Se crea una función en la base de datos, `mnt_close_session(session_id, signer, decisiones[])`, que sustituye los varios pasos del cierre actual (interno). Para el externo se crea `mnt_record_external(session_id, datos, excepciones[])`. Cada una, en una sola transacción:
1. Comprueba la organización y el permiso de ejecutar (`can_close_session`).
2. Marca los pendientes como omitidos, guarda resultados e instantánea y cierra la sesión solo si aún no estaba cerrada.
3. Por cada equipo aplica su decisión: actualiza `next_due_on` e inserta en la bitácora.
4. Si se repite la llamada (reintento o doble clic) y la sesión ya está cerrada, no hace nada y devuelve el estado.

El certificado se sigue emitiendo después, con el flujo idempotente actual. Así no puede quedar una sesión cerrada con las fechas sin actualizar. Si fallase el certificado, el reintento solo emite el certificado.

## 7. Permisos

- Confirmar o cambiar la fecha durante el cierre: quien puede cerrar sesiones (`can_close_session`), y solo para los equipos de esa sesión.
- Reprogramar libremente desde Próximos o Planes: quien gestiona planes (`can_manage_assets`), con la función `mnt_reschedule(plan_asset_id, new_due, reason)`. El motivo es obligatorio si ya había fecha.
- La identidad siempre la pone el servidor (`auth.uid()`), nunca un identificador enviado desde el navegador.

## 8. Próximos, Planes y sesiones (Bloque 1A)

- Próximos lee `next_due_on` en vez de calcularlo. Mantiene la agrupación plan + fecha y añade el grupo "Sin programar", la acción "Reprogramar" en "Ver equipos" y una marca discreta "última con incidencias".
- Exclusiones: activos retirados o borrados y vínculos con `end_on` vencido. Los averiados o en mantenimiento siguen apareciendo.
- `createSession` toma solo vínculos vigentes y activos no retirados.
- Sin truncado silencioso: se lee por bloques con `range` hasta el final y, si algo falla, se muestra un error. Sin vistas ni tablas de rendimiento.
- Histórico: no cambia.

## 9. Componentes afectados

- Dominio: `domain/due-date.ts` (`addMonthsClamped`, `toOrgDate`, `proposeDue`, `calendarAlternative`, `defaultDecision(result)`) y sus pruebas.
- Contratos y especificación: `UpcomingRow` añade `next_due_on` (fecha guardada), `scheduled`, `last_result` y `plan_asset_id`. Las operaciones `sessions.close` y `recordExternal` aceptan `decisiones[]` y `excepciones[]`. Nueva `plans.reschedule`. Primera fecha en `createPlan` y `addAssets`. `TenantPort.timezone` opcional. Se actualizan `spec/` y `install_v1.sql`, con pruebas en PostgreSQL desechable.
- Adaptador standalone: `sessions.repo.ts` (llama a las dos funciones), `plans.repo.ts` (primera fecha y reprogramar) y `listUpcoming`.
- UI: línea editable de próxima fecha en el diálogo de cierre (solo se despliega si hay excepciones o el usuario quiere cambiarla), excepciones en el registro externo, selector de primera fecha en Planes y "Reprogramar" en Próximos.

## 10. Pruebas de aceptación

- Fechas: 31-ene + 1 mes, 29-feb + 12 meses, intervalo de 60 meses, cierre a las 23:30 y a las 00:30 en Madrid.
- 5 extintores conformes: cierre sin preguntas, 5 fechas = real + intervalo y 5 entradas en la bitácora.
- 47 conformes y 3 omitidos: los 3 conservan la fecha y salen vencidos.
- Externo con 48 conformes y 2 con incidencias: los 50 avanzan por defecto y los 2 quedan marcados.
- "No avanzar" o exención sin motivo: se rechaza. "No aplica" global sin decisión: no se puede cerrar.
- Revisión tarde: queda `late = true` con la fecha prevista original; "Mantener calendario" propone prevista + intervalo.
- Doble cierre o reintento: un solo cambio de fechas. Fallo del certificado: las fechas quedan aplicadas y el reintento solo emite el certificado.
- Reprogramar sin permiso de gestión, o sin motivo cuando ya hay fecha: se rechaza. Quien hizo el cambio = usuario autenticado.
- Otra organización: no ve ni cambia fechas ni bitácora.
- Activo retirado: fuera de Próximos y presente en Histórico. Averiado: visible.
- Lectura de más de 1000 vínculos sin truncado (en base desechable).

## 11. Se aplaza

Reglas de tolerancia, calendarios reglamentarios, configuración de base por plan, relleno de fechas para clientes reales, reprogramación masiva avanzada, Histórico ordenado por fecha efectiva, vistas o columnas de rendimiento para grandes volúmenes y cualquier cambio en Incidencias.

## 12. Entregas

| Entrega | Contenido | Complejidad |
|---|---|---|
| 1B-1 | Dominio de fechas y pruebas | Baja |
| 1B-2 | Migración, tres funciones, instalador limpio y pruebas SQL | Media |
| 1B-3 | Próximos sobre `next_due_on`, exclusiones, lectura sin truncado y sesiones filtradas | Baja-Media |
| 1B-4 | Cierre interno y externo con resultado común, excepciones y fecha editable | Media |
| 1B-5 | Primera fecha en Planes y "Reprogramar" | Baja |

## 13. Decisión técnica imprescindible

Cerrar con una función de la base de datos en lugar del cierre por pasos actual. **Recomendación para pyme: sí.** Es la única forma sencilla de garantizar que la sesión cerrada y las fechas cambian juntas, y además simplifica los reintentos. Sustituye código existente y no lo duplica.
