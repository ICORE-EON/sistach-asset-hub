# Planes de mantenimiento por familia y ubicación

Objetivo: crear un plan (p. ej. "Revisión trimestral de equipos contra incendios") eligiendo la familia de equipos y una o varias ubicaciones, y que los equipos se añadan de golpe, sin ir uno por uno. También sigue siendo posible un plan para un solo equipo.

## Cómo quedará

**Al crear el plan** (mismo diálogo de "Nuevo plan", ampliado):
1. Código, nombre y frecuencia (igual que ahora).
2. Tipo/familia de activo y plantilla publicada (igual que ahora).
3. Nuevo paso "Alcance":
   - Ubicaciones: ninguna (toda la empresa), una o varias; con opción "incluir sububicaciones".
   - Vista previa: "Se añadirán 23 equipos" con la lista, y casillas para desmarcar los que no quieras.
   - Alternativa "Equipos concretos": buscador para marcar solo uno o unos pocos.
4. Al guardar, el plan queda creado con todos los equipos vinculados.

**En la ficha del plan:**
- Se muestra el alcance guardado (familia + ubicaciones) como texto legible.
- Aviso automático cuando hay equipos que encajan en el alcance y no están en el plan: "3 equipos nuevos encajan con este plan" + botón "Añadir los 3" o revisión uno a uno. Igual para equipos del plan que ya no encajan (cambiaron de ubicación, dados de baja): aviso y botón para quitarlos.
- El botón "Añadir activos" pasa a tener filtro por ubicación, buscador y "seleccionar todos los visibles", en vez de la lista plana actual.

**Sesiones de mantenimiento:** sin cambios de flujo; al crear una sesión desde el plan se generan las tareas de todos los equipos vinculados en ese momento.

## Detalles técnicos

Base de datos (una migración):
- `maintenance_plans`: nuevas columnas `scope_mode text not null default 'manual'` (`'manual' | 'scoped'`), `scope_location_ids uuid[] not null default '{}'`, `scope_include_sublocations boolean not null default true`. Sin cambios en RLS/grants existentes.
- `maintenance_plan_assets` se mantiene como fuente de verdad de los equipos cubiertos (así el histórico y las sesiones no cambian).

Frontend:
- `src/lib/maintenance-scope.ts` (nuevo): resolver el alcance → consulta de `assets` filtrada por `company_id`, `asset_type_id`, `deleted_at is null`, `status`, y `location_id in (ubicaciones + descendientes)`; expansión recursiva del árbol de `locations` por `parent_location_id`; helpers `diffScope(planAssets, scopedAssets)` → `{ missing, extra }`.
- `_app.maintenance-plans.index.tsx`: diálogo de creación ampliado (selección múltiple de ubicaciones, vista previa con checkboxes, inserción en lote de `maintenance_plan_assets` tras crear el plan).
- `_app.maintenance-plans.$id.tsx`: tarjeta de alcance editable (solo roles que ya pueden gestionar), banner de diferencias con acciones de añadir/quitar en lote, y diálogo de asignación con filtro por ubicación + "seleccionar todos".
- Textos en español, componentes existentes de `@/components/ui`.
