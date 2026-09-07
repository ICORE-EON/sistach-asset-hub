# Plantillas de checklist por familia, tipos y centros

Hoy cada plantilla de checklist está atada a un único tipo de activo. Pasará a definirse por familia, con la posibilidad de elegir todos los tipos de esa familia o solo algunos, y los centros (ubicaciones) donde se aplica.

## Cómo quedará

**Crear / editar una plantilla**
- Eliges la **familia de activos** (Equipos PCI, botiquines, vehículos…).
- Eliges los **tipos de activo**: por defecto "Todos los tipos de la familia", o marcas solo los que quieras (Extintor CO2, BIE 25 mm…). Si más adelante añades un tipo nuevo a la familia, la plantilla "todos" lo cubre automáticamente.
- Eliges los **centros**: por defecto "Todos los centros", o marcas ubicaciones concretas (con opción de incluir sububicaciones).
- Código, nombre y descripción siguen igual, igual que el versionado (borrador → publicada).

**Listado de plantillas**
- La columna "Tipo de activo" pasa a mostrar: familia, y debajo "Todos los tipos" o el número de tipos marcados, más "Todos los centros" o el número de centros.
- Filtros por familia y por centro para encontrarlas rápido.

**Dónde se nota**
- Al crear un **plan de mantenimiento**, para cada tipo presente en el alcance se proponen las plantillas que aplican a ese tipo **y** a los centros del plan; el resto ya no aparece. Si varias aplican, se propone la más específica (tipos concretos + centros concretos gana a "todos"), y siempre puedes cambiarla a mano.
- Las **sesiones** y los checklists ya rellenados no cambian: siguen apuntando a la versión de plantilla con la que se hicieron.

**Compatibilidad**
- Las plantillas actuales se convierten solas: familia = la del tipo que tienen hoy, tipos = ese único tipo, centros = todos.

## Detalles técnicos

Migración:
- `checklist_templates`: `asset_family_id uuid references asset_families(id)`, `asset_type_ids uuid[] not null default '{}'` (vacío = todos los tipos de la familia), `location_ids uuid[] not null default '{}'` (vacío = todos), `include_sublocations boolean not null default true`.
- `asset_type_id` pasa a nullable y se conserva por compatibilidad; backfill: `asset_family_id` desde `asset_types.family_id`, `asset_type_ids = ARRAY[asset_type_id]`.
- Índices GIN sobre `asset_type_ids` y `location_ids`.

Frontend:
- `src/lib/checklist-scope.ts` (nuevo): `templateAppliesTo(template, { assetTypeId, locationId, locations })`, `resolveTemplatesForType(...)` con ranking de especificidad y `describeTemplateScope(...)` para el texto del listado.
- `_app.checklist-templates.index.tsx`: diálogo de creación con familia + selección múltiple de tipos ("todos" por defecto) + selección múltiple de centros; columnas y filtros nuevos.
- `_app.checklist-templates.$id.tsx`: tarjeta "Ámbito de aplicación" editable (familia, tipos, centros) para administradores.
- `_app.maintenance-plans.index.tsx` y `.$id.tsx`: el mapa tipo→plantilla usa la nueva resolución por familia/tipo/centro en lugar de filtrar por `asset_type_id`.
- `src/lib/asset-families.ts`: `fetchPublishedTemplates` devuelve también familia, tipos y centros.

## Orden de trabajo
1. Migración y backfill.
2. Creación y edición de plantillas con el nuevo ámbito.
3. Listado con filtros y descripción del ámbito.
4. Resolución de plantilla en planes de mantenimiento.
