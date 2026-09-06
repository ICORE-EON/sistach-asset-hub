# Familias de activos y mantenimientos por familia

Objetivo: introducir el nivel "Familia de activos" por encima del tipo de activo, y que planes, sesiones y certificados trabajen por familia.

```text
Familia (Equipos PCI) -> Tipo (Extintor CO2, BIE 25mm, Señal) -> Activo (BERG-01, BERG-02...)
```

## Cómo quedará

**1. Familias de activos (nueva pantalla)**
- Lista de familias con su nombre, color/icono y los tipos incluidos.
- Familias iniciales creadas automáticamente a partir de lo que ya tienes: Equipos PCI (extintores, BIEs, señalización, alarmas, luces de emergencia), Botiquines y DEA, Vehículos, Maquinaria, Otros. Podrás crear, renombrar y reasignar tipos.
- Un tipo de activo pertenece a una sola familia.

**2. Crear un plan de mantenimiento**
- Eliges **familia** (en vez de un solo tipo) y una o varias **ubicaciones**.
- Los equipos encontrados se listan **agrupados por ubicación y, dentro de cada ubicación, por tipo de activo**, con contador por grupo y casillas "marcar todo el grupo"; marcas todos o solo los que quieras.
- Para cada tipo presente se elige la **plantilla de checklist** (se propone la publicada por defecto de ese tipo). Si un tipo no tiene plantilla, se avisa y no se puede incluir hasta crearla.
- Se elige la **plantilla de certificado** de la familia, o "sin certificado" si esa familia no lo requiere.
- Sigue existiendo el modo "Equipos concretos" para un plan de una sola máquina.

**3. Sesión de mantenimiento**
- Al abrir la sesión desde el plan se generan las tareas de todos los equipos vinculados, cada uno con el checklist de **su tipo**.
- La sesión empieza por **¿dónde estás?**: lista de ubicaciones del plan con su progreso (revisados / pendientes). Eliges una ubicación.
- Dentro de la ubicación se ven los **tipos de activo** con su contador; eliges el tipo y luego el equipo concreto.
- Rellenas y guardas el checklist del equipo, vuelves a la lista y pasas al siguiente; puedes cambiar de ubicación en cualquier momento y dejar equipos sin revisar.
- Al finalizar, si quedan equipos sin revisar se pide confirmación y la sesión queda con resultado: **Correcto**, **Con incidencias**, **Con equipos sin revisar** o ambas cosas.


**4. Certificado**
- Se genera con la plantilla de la familia del plan (si la familia no requiere certificado, se omite y se indica en la sesión).
- El certificado incluye los equipos agrupados por tipo, con su resultado, y una sección aparte con los **equipos no revisados** y otra con las **incidencias abiertas**.

**5. Historial por equipo**
- En la ficha de cada equipo, nueva pestaña "Historial": mantenimientos realizados (fecha, plan, sesión, resultado), incidencias asociadas y certificados en los que aparece, con enlaces directos.

## Detalles técnicos

Base de datos (una migración):
- `asset_families` (company_id nullable para familias de sistema, `code`, `name_i18n`, `color`, `sort_order`, `active`) con GRANTs + RLS por membresía y gestión limitada a administrator/system_manager.
- `asset_types.family_id uuid references asset_families(id)`; backfill desde `category`.
- `maintenance_plans.asset_family_id uuid`; `asset_type_id` se mantiene para planes existentes/específicos.
- `maintenance_plan_assets.checklist_template_id uuid` (o tabla `maintenance_plan_type_templates(plan_id, asset_type_id, checklist_template_id)`) para resolver el checklist por tipo.
- `certificate_templates.asset_family_id uuid` + `asset_families.requires_certificate boolean default true`.
- `maintenance_sessions`: columna derivada `outcome text` (`ok | with_incidents | incomplete | incomplete_with_incidents`) calculada al cerrar.

Frontend:
- `src/lib/asset-families.ts`: consultas de familias, tipos por familia, resolución de plantilla de checklist por tipo.
- `src/lib/maintenance-scope.ts`: `fetchScopeAssets` acepta `assetFamilyId` (expandido a la lista de `asset_type_id`).
- Nueva ruta `_app.asset-families.tsx` (CRUD + asignación de tipos) y entrada en el sidebar; `_app.asset-types.tsx` gana columna/selector de familia.
- `_app.maintenance-plans.index.tsx` y `.$id.tsx`: selección por familia, vista previa agrupada por tipo, mapa tipo→plantilla de checklist.
- `_app.maintenance.index.tsx`: creación de tareas usando la versión publicada del checklist correspondiente a cada tipo.
- `_app.maintenance.$id.tsx`: navegación en tres niveles (ubicación → tipo → equipo) con contadores por nivel y cierre con resumen de resultado.
- `src/lib/certificate-generator.ts` y `certificate-pdf.ts`: resolución de plantilla por familia, agrupación por tipo, sección de no revisados.
- `_app.assets.$id.tsx`: pestaña de historial (sesiones, incidencias, certificados).
- Textos en español, componentes existentes de `@/components/ui`.

## Orden de trabajo
1. Migración + pantalla de familias y asignación de tipos.
2. Planes por familia (creación y ficha).
3. Sesiones agrupadas por tipo y cierre con resultado.
4. Certificados por familia con no revisados/incidencias.
5. Historial en la ficha del equipo.
