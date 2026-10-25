# Investigación de integridad 2A — diferencia de recuentos (solo lectura)

## Conclusión
No desapareció ninguna fila. La diferencia viene de **cómo se contó**. El informe E2E anterior contó vínculos, ítems y documentos **de todas las organizaciones**. El cierre técnico los contó **solo de Sistach**. Las filas de más son de la otra organización (Toni Enterprises, `e5b35c19…`). Esas filas siguen existiendo hoy, intactas.

## Hechos verificados (consultas del 2026-10-25)

| Colección | Sistach | Todas las organizaciones | Delta |
|---|---:|---:|---:|
| Vínculos activo-plan | 7 | 8 | -1 |
| Ítems de mantenimiento | 6 | 16 | -10 |
| Documentos (todos sin borrar) | 2 | 3 | -1 |

Las cifras globales actuales (8/16/3) coinciden exactamente con las del informe antiguo. Las de Sistach (7/6/2) coinciden con las del cierre técnico.

Filas que explican cada delta. Todas pertenecen a `e5b35c19-afd3-4675-9654-070e8a8ffc7d` y se crearon antes de cualquier prueba 2A:
- **Vínculo (1):** `4b23a903-fd91-4586-90d1-353f0658b228` (creado el 2026-05-31).
- **Ítems (10):** `e654b44a…`, `785b092d…`, `d7c2c045…`, `cb1a809b…`, `db797062…` (2026-05-31), y `9ac28224…`, `a8ae7db9…`, `2239ca56…`, `4a856e41…`, `b2ae615a…` (2026-06-08).
- **Documento (1):** `d22e8b5c-7745-42ab-ac13-47c2737b15bb` (2026-05-31, sin `deleted_at`).

Causa del criterio mixto: las tablas de vínculos e ítems no tienen columna de organización. Para filtrar hay que pasar por el plan o la sesión. El informe antiguo filtró activos, planes y sesiones por organización (por eso coinciden 4/4/3), pero contó vínculos, ítems y documentos sin ese filtro.

## Lo que no se puede reconstruir
- La bitácora de auditoría no tiene ninguna entrada (alta, cambio ni borrado) para vínculos, ítems ni documentos. Así que no hay rastro auditable de lo que pasó en estas tablas antes de este turno.
- No se conserva la consulta exacta que generó el informe antiguo. La explicación del criterio mixto es una inferencia, pero muy fuerte: las 12 filas encajan exactamente y siguen presentes.

## Pérdida por la limpieza anterior
- **Descartada para estos tres deltas:** las 12 filas que faltaban en el recuento de Sistach existen hoy, sin cambios, en la otra organización.
- **No se puede descartar del todo para filas TEST** que se crearon y borraron entre recuentos, porque no hay bitácora de esas tablas. Pero ningún recuento de referencia de datos reales cambió.
- Desde que existen las protecciones 2A, borrar directamente vínculos, sesiones, activos o evidencias desde la app queda bloqueado. Una limpieza que se repitiera por esa vía sería rechazada, y la batería 2A lo confirma (casos 11–13, 40–43).

## Riesgo para futuros clientes
- **Bajo para los datos:** no hay mezcla entre organizaciones. Los permisos por organización siguen funcionando.
- **Medio para los informes:** contar sin filtrar por organización puede hacer creer que se perdieron datos, o que se mezclan clientes.
- **Vacío de trazabilidad:** vínculos, ítems y documentos no dejan rastro en la bitácora.

## Prevención (sin funciones nuevas)
1. Las comprobaciones de recuento y huella filtran siempre por organización a través de plan o sesión, y se indica el criterio en el informe.
2. Cada informe guarda las consultas exactas junto a los resultados.
3. Se toma una huella antes y después de cada prueba E2E con el mismo script.
4. Se apunta como riesgo conocido que estas tres tablas no tienen bitácora. Es decisión del usuario si se añade en otro bloque.

## Si se aprueba
Solo documentación: añadir esta conclusión a `tests/sql/results/mnt_2a_2026-10-25.md` y marcar el Bloque 2A como COMPLETADO en el roadmap. La discrepancia queda explicada sin pérdida de datos. No se tocan datos ni los 3 eventos TEST.
