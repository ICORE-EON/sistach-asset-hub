# Bloque 1B — Motor de vencimientos: auditoría y propuesta (solo análisis)

Alcance: `sessions.repo.ts` (`listUpcoming`, `closeSession`, `recordExternal`, `setItemResult`, `createSession`), `maintenance_plan_assets`, `maintenance_items`, Bloque 1A (Próximos / Histórico / Planes). Nada se implementa en este encargo.

## (a) Diagnóstico

Leyenda: C = confirmado por código o datos; H = hipótesis por verificar.

| # | Problema | Evidencia | Estado | Riesgo | Prioridad |
|---|---|---|---|---|---|
| 1 | Los equipos `skipped` (y cualquier resultado) cuentan como "realizado": `d = it.completed_at ?? s.closed_at` no filtra por resultado. Un equipo omitido reinicia el ciclo con la fecha de cierre | `listUpcoming` l.185-187; `closeSession` l.288-291 marca pending→skipped sin `completed_at` | C (código). En los datos de prueba hoy hay 0 casos | Alto: un equipo no revisado aparece "al día" | P1 |
| 2 | `not_applicable` también reinicia el ciclo (tiene `completed_at` = ahora) | `setItemResult` l.263-266 | C | Medio | P1 |
| 3 | Resultado desfavorable (`with_incident`, `failed` externo) reinicia el ciclo. Es correcto si se acepta que "realizada ≠ conforme", pero hoy no es una decisión explícita y Próximos no muestra que el último resultado fue desfavorable | l.185-187; `recordExternal` l.234 | C | Medio (falta de visibilidad) | P2 |
| 4 | La base es siempre la fecha real (última finalización). No hay opción "desde fecha prevista" | l.197-199 | C | Bajo/decisión | P2 |
| 5 | Primera fecha con `start_on`: calcula `start_on + intervalo` cuando debería vencer **en** `start_on` | l.197-199 | C | Alto: el primer ciclo se retrasa un periodo entero | P1 |
| 6 | Sin `start_on` ni historial: próxima = hoy, se recalcula cada día (nunca vencido, siempre "hoy") | l.199 `new Date()` | C (hoy los 8 vínculos tienen `start_on`) | Medio | P1 |
| 7 | Vínculos con `start_on` futuro se tratan igual (próxima = futuro + intervalo) | l.194-199 | C | Medio | P1 |
| 8 | Fin de mes: `setMonth` desborda (31-ene + 1 mes = 3-mar; 29-feb + 12 = 1-mar) | l.199 | C | Medio | P1 |
| 9 | Zona horaria: se mezcla `closed_at` UTC con `setMonth` en hora local y `toISOString().slice(0,10)`; "hoy" se calcula en UTC. Puede desplazar un día cerca de medianoche | l.193, l.199; `recordExternal` l.235 (`T12:00` local) | C mecanismo / H impacto real | Bajo-Medio | P2 |
| 10 | No se excluyen activos retirados/inactivos ni borrados | `listUpcoming` no consulta `assets` | C (hoy todos `active`) | Medio | P1 |
| 11 | `createSession` no filtra activos inactivos ni vínculos caducados/futuros (`end_on`, `start_on`) | l.99-104 | C | Medio | P2 |
| 12 | Planes pausados: ya se excluyen (`active=true`, `deleted_at is null`) | l.173-174 | C (correcto) | — | — |
| 13 | Sesiones abiertas: se marca la sesión abierta, correcto. Canceladas: no cuentan, correcto. Una sesión parcial cerrada actualiza solo los hechos… salvo el fallo #1 | l.180-190 | C | — | vía #1 |
| 14 | Múltiples ejecuciones: se toma la máxima fecha, correcto. Externa: usa `performed_on` (vía `completed_at`), correcto | l.187, l.235 | C | — | — |
| 15 | Escalabilidad: tres consultas sin paginar; PostgREST limita a 1000 filas → con >1000 vínculos o ítems cerrados los resultados se truncan **en silencio**; además se traen todas las sesiones cerradas históricas | l.177-183 | C (límite) / H (umbral real) | Alto a escala | P1 |
| 16 | Errores: `ok()` lanza error, pero `links/done/open` sin error se tratan como vacío; aislamiento por `company_id` en sesiones, vínculos acotados por `plan_id` de la org (correcto vía RLS) | l.177-185 | C | Bajo | P3 |
| 17 | Histórico ordena por `closed_at` (fecha administrativa), no por fecha efectiva | `listInterventions` l.211 | C | Bajo | P3 |

## (b) Reglas de negocio propuestas

Principio: separar tres conceptos por equipo y ejecución.
- **Realización**: el equipo se revisó (resultado `ok`, `with_incident`, `failed`). Avanza el ciclo.
- **Resultado**: conforme / no conforme. Se muestra en Próximos ("Último: con incidencias") pero no bloquea el avance.
- **Seguimiento**: las incidencias siguen su propio circuito (módulo Incidencias existente). Sin motor nuevo.

Reglas:
1. `skipped` (o `pending` al cerrar): **no** es realización. No avanza el ciclo; el equipo sigue vencido/pendiente.
2. `not_applicable`: **DECISIÓN DE PRODUCTO**. Opción A (recomendada): no avanza el ciclo (no se hizo). Opción B: avanza (el equipo "no requería" esa revisión este periodo).
3. Desfavorable: avanza el ciclo (sí se ejecutó). Opcional, **DECISIÓN**: marcar "Último resultado: con incidencias" en Próximos.
4. Base del cálculo — **DECISIÓN** a nivel de plan (sin columna nueva en MVP: opción global):
   - "Desde fecha real" (actual; recomendada por defecto, simple).
   - "Desde fecha prevista": próxima = prevista + intervalo, aunque se haga tarde (mantiene calendario fijo; útil para reglamentarias). Requiere guardar la fecha prevista en la ejecución (en `metadata` de la sesión, sin tabla nueva).
5. Primera fecha: sin historial → vence en `start_on`. Sin `start_on` → **DECISIÓN**: A) vence en la fecha de alta del vínculo (`created_at`), B) "Sin programar" (recomendada: no inventa fecha).
6. Vínculo con `start_on` futuro: aparece en Próximos con esa fecha; no entra en sesiones hasta su inicio.
7. Fin de mes: aritmética de fecha calendario con recorte al último día (31-ene +1 = 28/29-feb; 29-feb +12 = 28-feb).
8. Zona horaria: todo en fechas calendario (`YYYY-MM-DD`). Fecha de realización interna = día local de la organización (Europa/Madrid en standalone; en ICORE, zona de la org vía host). "Hoy" en la misma zona.
9. Exclusiones en Próximos y en nuevas sesiones: activos no `active` o borrados, vínculos con `end_on < hoy`, planes inactivos. El histórico no se toca.

## (c) Enfoque técnico mínimo viable

Recomendado: **función pura de dominio + consulta acotada, sin tablas nuevas**.
- `domain/due-date.ts` (puro, probado): `addMonthsClamped`, `isExecution(result, naRule)`, `nextDue({ lastExecution, lastPlanned, startOn, intervalMonths, basis })`, `toOrgDate(iso, tz)`.
- `listUpcoming` usa esa función, filtra estados y pagina la carga.

Alternativas valoradas:
- Vista/función SQL `mnt_upcoming` (calcular en BD): mejor escala, pero duplica reglas en SQL y TS y añade migración. Coste medio-alto. Recomendado solo si se superan ~5–10k vínculos.
- Columna `next_due_on` materializada en `maintenance_plan_assets` actualizada al cerrar: rápida, pero requiere migración, triggers y recálculo. Coste alto; descartado para MVP.

Escalabilidad en el MVP: consultar solo la **última** ejecución válida por plan+equipo (filtrando `result in (...)` y `completed_at not null`, orden desc) con paginación por bloques de 1000 (`range`) hasta agotar; error explícito si una página falla.

## (d) Cambios precisos

- Dominio: nuevo `domain/due-date.ts` + tests.
- Contrato `UpcomingRow` (aditivo): `last_result` (`ok|with_incident|failed|null`), `due_basis` (`actual|planned`), `scheduled: boolean` (false = "Sin programar"). Documentar en `spec/DTO_MAPPING.md` e `ICORE_ADAPTER_SPEC.md`.
- Adaptador `sessions.repo.ts`:
  - `listUpcoming`: excluir `skipped`/`pending` (y `not_applicable` según decisión), no usar `closed_at` como fallback, filtrar activos (`assets.status='active'`, `deleted_at is null`), primera fecha = `start_on`, paginación, cálculo vía dominio.
  - `setItemResult`/`closeSession`: sin cambio de datos; solo, si se elige "desde prevista", guardar `metadata.planned_on` al crear la sesión.
  - `createSession`: excluir activos inactivos y vínculos fuera de `start_on..end_on`.
  - `listInterventions`: sin cambio (ver 9).
- UI (Bloque 1A): Próximos muestra estado "Sin programar" y, opcional, marca de último resultado desfavorable. Columnas y agrupación plan+fecha se mantienen; los equipos omitidos pasan a una fila "Vencido" separada (comportamiento esperado).
- Servicio `sessions.ts`: sin cambios de firma.

## (e) Pruebas de aceptación

Dominio (unitarias):
- 31-ene +1 mes = 28-feb (2027) / 29-feb (2028); 29-feb-2028 +12 = 28-feb-2029; 30-nov +3 = 28/29-feb; +24 meses; intervalo custom 60 meses.
- Cierre a las 23:30 Madrid (22:30 UTC) cuenta como ese día local; 00:30 Madrid como el siguiente.
- Sin historial con `start_on` = vence en `start_on`; `start_on` futuro; sin `start_on` = sin programar.
- Ejecución tardía: base real vs prevista dan fechas distintas y correctas.

Adaptador (integración, org de prueba):
- Sesión parcial: 3 equipos, 2 ok + 1 omitido → el omitido sigue vencido, los otros avanzan.
- `with_incident` avanza y expone `last_result`.
- `not_applicable` según regla elegida.
- Externa con `performed_on` anterior al registro usa `performed_on`.
- Activo retirado y vínculo con `end_on` pasado desaparecen de Próximos y siguen en Histórico.
- Plan pausado excluido. Sesión abierta marcada; cancelada ignorada.
- 1500 vínculos sintéticos: sin truncado (en BD desechable o con adaptador de prueba, no en datos reales).
- Aislamiento: otra org no ve filas.

## (f) Portabilidad e ICORE

Reglas en `domain/` (puras, exportables). El adaptador ICORE implementa la misma consulta; la zona horaria la aporta el host (TenantPort, dato nuevo opcional `timezone`, por defecto Europe/Madrid). Sin dependencias standalone en capas exportables; `module-boundary.test.ts` lo vigila.

## (g) Riesgos sobre datos existentes

- Datos de prueba: sin migración. Al aplicar la regla, algunos equipos cambiarán de "al día" a "vencido" (efecto deseado).
- Histórico y certificados no se alteran: solo cambia el cálculo de lectura.
- "Desde prevista" solo aplica a ejecuciones nuevas (las antiguas no tienen `planned_on`; se usa la real).

## (h) Preguntas imprescindibles antes de autorizar

1. `not_applicable`: ¿avanza el ciclo (B) o no (A, recomendado)?
2. Base del cálculo: ¿solo "desde real" (recomendado MVP) o también "desde prevista" por plan (requiere un ajuste por plan, guardado sin tabla nueva)?
3. Equipo sin `start_on` ni historial: ¿"Sin programar" (recomendado) o vence en su fecha de alta?
4. ¿Mostrar en Próximos "Último resultado con incidencias"? (sí/no)
5. Zona horaria fija Europe/Madrid para standalone: ¿confirmado?

## (i) Complejidad y entregas

| Entrega | Contenido | Complejidad |
|---|---|---|
| 1B-1 | Dominio de fechas (fin de mes, zona horaria, primera fecha) + tests | Baja |
| 1B-2 | `listUpcoming`: reglas de realización, exclusiones, paginación; contrato aditivo; specs | Media |
| 1B-3 | `createSession` filtra activos/vínculos; UI "Sin programar" y marca de resultado | Baja |
| 1B-4 (opcional) | Base "desde prevista" por plan | Media |
| 1B-5 (opcional) | Histórico por fecha efectiva: no recomendado ahora; ordenar por un valor calculado rompe la paginación del servidor sin columna o vista nueva | Media-alta |

Propuesta: autorizar 1B-1 a 1B-3 tras responder (h); 1B-4 y 1B-5 quedan aparte.
