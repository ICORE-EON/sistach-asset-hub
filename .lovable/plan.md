# Bloque 1A — Auditoría de Próximos, Histórico y Planes (solo análisis)

No cambia nada en código, datos ni base de datos. Todos los registros actuales son de prueba.

## 1. Piezas implicadas

- Pantalla contenedora: `ui/pages/MaintenanceHubPage.tsx` (pestañas, `useAssetFilters`, `UpcomingTab`, `HistoryTab`, `DueBadge`, `groupBy`).
- Histórico por activo: `ui/components/asset-history-panel.tsx` (abierto en un panel lateral desde Histórico).
- Sesiones: `ui/pages/SessionsListPage.tsx` (lista con búsqueda y estado; hoy solo se reutiliza `CreateSessionDialog`; ninguna ruta monta la lista).
- Planes: `ui/pages/PlansListPage.tsx` (`embedded`; columnas Código, Nombre, Familia, Tipo, Plantilla, Frecuencia, Estado).
- Servicios: `services/sessions.ts` (`listUpcoming`, `listSessions`, `listAssetHistory`), `services/plans.ts` (`listPlans`, `planFrequencyLabel`), `services/assets.ts` (filtros).
- Contratos: `contracts/repositories.ts` (`UpcomingRow`, sesiones, planes), `contracts/operations.ts`, `spec/ICORE_ADAPTER_SPEC.md`, esqueleto `adapters/icore/repositories.ts`.
- Adaptador de esta app: `adapters/standalone/repos/sessions.repo.ts` (`listUpcoming` l.171-203, `listSessions` l.41, `listAssetHistory` l.77), `plans.repo.ts` (`listPlans`).
- Tablas leídas: `maintenance_plans`, `maintenance_plan_assets`, `maintenance_sessions`, `maintenance_items`, `assets`, `asset_types`, `mnt_asset_categories`, `locations`, `documents` (evidencias), `certificates`.

## 2. Reutilización posible

- Próximos: los datos agrupados ya existen en la propia pantalla; basta cambiar el valor por defecto del interruptor y añadir enlaces.
- Histórico: `listSessions(org, "closed")` ya devuelve sesiones cerradas con plan, `closed_at`, `outcome`, `is_external`, proveedor y `metadata.close_snapshot` (alcance y resultado por equipo). La tabla de `SessionsListPage` puede extraerse como componente `SessionsTable` y usarse en ambas.
- Histórico por activo: se conserva `AssetHistoryPanel` tal cual.
- Planes: `listUpcoming` ya da equipos y próxima fecha por plan; se puede agregar en la pantalla sin consulta nueva.

## 3. Cambios por pantalla

### Solo pantalla
- Próximos: "Agrupar por categoría" apagado por defecto; orden por defecto Estado y luego Próxima fecha; enlace del nombre del plan a su ficha; botón "Continuar sesión" visible cuando hay sesión abierta; enlace a la ficha del activo en el equipo único y en la lista "Ver equipos".
- Planes: columnas Nombre (con código pequeño debajo), Frecuencia, Modo interno/externo, Nº activos, Próximo vencimiento, Estado. Familia, Tipo y Plantilla pasan a la ficha del plan o a un texto secundario.
- Filtros: una barra única con buscador siempre visible y Categoría/Tipo/Ubicación en un desplegable "Filtros (n)"; el interruptor de agrupación al lado.

### Requieren servicio (sin esquema)
- Histórico como lista de intervenciones: hoy `listSessions` limita a 100, ordena por `created_at` y no trae número de evidencias. Propuesta: parámetro opcional de orden por `closed_at` y un recuento de documentos/certificado por sesión (consulta adicional en el adaptador, campo opcional en el contrato).
- Avance de sesiones abiertas en Próximos ("12 de 50 hechos"): necesita contar ítems completados de la sesión abierta; `listUpcoming` solo trae `asset_id`. Añadir `completed_at` a esa lectura y un campo opcional en `UpcomingRow`.

### Requieren esquema
- Ninguno en 1A.

## 4. Datos existentes y faltantes

- Alcance: existe (vínculos plan-activo y `close_snapshot` por sesión). Fiable para sesiones cerradas.
- Resultado: existe `outcome` en sesión y `result` por ítem. Las sesiones cerradas antes de `close_snapshot` pueden no tenerlo; mostrar "—".
- Fecha real: `closed_at`; en externas, `metadata.external.performed_on` (más fiable que `closed_at`, que es la fecha de registro).
- Evidencias: documentos y certificados vinculados a la sesión; falta un recuento ya calculado.
- Vencimientos: calculados al vuelo; no se guardan. Ver Bloque 1B.
- Avance de sesión abierta: dato disponible pero no leído.

## 5. Riesgos y regresiones

- Cambiar la agrupación por defecto puede sorprender a quien ya la usa (bajo).
- Histórico por intervención con límite 100 puede ocultar registros antiguos: añadir paginación o límite mayor.
- Fecha de externas: mostrar `closed_at` daría una fecha incorrecta.
- Recuentos de evidencias: deben filtrarse por empresa (RLS ya lo hace; no usar acceso privilegiado).
- Calcular el próximo vencimiento de cada plan en la pantalla Planes depende de `listUpcoming`: si falla, la columna queda vacía en vez de bloquear la lista.

## 6. Impacto en ICORE

- Cambios solo de pantalla: ninguno.
- Campos nuevos opcionales en `UpcomingRow` y en la lista de sesiones: actualizar `ICORE_ADAPTER_SPEC.md` y `DTO_MAPPING.md`; el esqueleto ICORE no cambia de firma. Contratos siguen recibiendo `orgId` explícito; nada del adaptador standalone entra al módulo.

## 7. Complejidad relativa

| Mejora | Tipo | Complejidad |
|---|---|---|
| Agrupación apagada y orden por defecto | Pantalla | Baja |
| Enlaces a plan, activo y sesión abierta | Pantalla | Baja |
| Planes: Nº activos y próximo vencimiento | Pantalla | Baja-media |
| Filtros compactos | Pantalla | Baja |
| Histórico por intervenciones (reutilizando tabla) | Pantalla + servicio menor | Media |
| Evidencias por intervención | Servicio | Media |
| Avance de sesión abierta | Servicio | Media |

## 8. Propuesta mínima Bloque 1A

1. Próximos: agrupación apagada, orden Estado + Fecha, enlaces a plan/activo/sesión abierta.
2. Histórico: vista principal "Intervenciones" (sesiones cerradas, más reciente primero) con Fecha real, Plan, Alcance (nº equipos del snapshot), Resultado, Interna/Externa y enlace al detalle; selector secundario "Por activo" con la vista actual. Tabla compartida con `SessionsListPage`. Orden por `closed_at` en el adaptador.
3. Planes: columnas orientadas al responsable con Nº activos y Próximo vencimiento.
4. Filtros compactos comunes.
Fuera de 1A: recuento de evidencias y avance de sesión abierta (1A-bis, si se aprueba).

## 9. Pruebas de aceptación

- Próximos abre sin agrupar, ordenado vencidos primero; el interruptor sigue agrupando.
- Un plan con 3 equipos muestra una fila y "Ver equipos" lista los 3 con enlace a cada ficha.
- Con sesión abierta aparece "Continuar sesión" y lleva a esa sesión.
- Histórico lista solo sesiones cerradas de la empresa activa; cambiar de empresa cambia la lista.
- Una revisión externa muestra la fecha de realización, no la de registro.
- "Por activo" sigue abriendo el panel con su historial.
- Planes: el Nº activos coincide con la ficha del plan; el vencimiento coincide con el más cercano de Próximos.
- Un usuario sin permiso de gestión no ve la pestaña Planes.
- Pruebas actuales de aislamiento por empresa y frontera del módulo siguen pasando.

## Bloque 1B — Problemas detectados en el cálculo de próximos (no implementar)

Cálculo actual en `sessions.repo.ts` l.171-203:
1. Omitidos cuentan como hechos: los equipos que quedan "skipped" al cerrar toman `closed_at` como último realizado y reinician el ciclo.
2. Resultado desfavorable reinicia el ciclo: un equipo "failed" o externo "Con incidencias" se considera al día.
3. "No aplica" también cuenta como realizado.
4. Programación desde fecha real: la próxima se calcula desde la ejecución; una ejecución tardía desplaza todos los ciclos siguientes. No existe opción de calcular desde la fecha prevista.
5. Externas: usa `completed_at` = fecha de realización (correcto), pero si falta cae a `closed_at` (fecha de registro).
6. Sin historial ni `start_on`: la próxima fecha es hoy, lo que aparece como "vence hoy" en planes recién creados.
7. Con `start_on`: la primera fecha es `start_on + intervalo`, no `start_on`.
8. Sumar meses con `setMonth` desborda fin de mes (31 ene + 1 mes = 3 mar) y la conversión a UTC puede mover un día.
9. No excluye activos dados de baja ni vínculos con `start_on` futuro; tampoco pagina (límite de filas del servidor).
10. Sesiones canceladas no cuentan (correcto), pero una sesión abierta se asigna al equipo aunque ya esté hecho en ella.

Para 1B habrá que decidir: qué resultados reinician el ciclo, si se programa desde fecha prevista o real, y cómo tratar la primera fecha.

## Para aprobación

Aprobar el Bloque 1A según el punto 8 (sin cambios de esquema; único cambio de servicio: orden del histórico por fecha de cierre). El 1A-bis y el 1B quedan pendientes de decisión aparte.
