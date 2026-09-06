# Importación masiva del contenido de los botiquines

Sí se puede hacer. La base de datos ya tiene una tabla preparada para guardar el contenido de cada botiquín (producto, cantidad, lote, fecha de caducidad y notas), vinculada al activo botiquín. Lo que falta es la pantalla de importación y la de consulta/edición.

## Cómo funcionará

El proceso será en dos pasos:

1. **Importas los botiquines como activos** (ya funciona hoy). Cada botiquín es un activo con su código propio, por ejemplo `BOT-001`, `BOT-002`.
2. **Importas el contenido** con un único archivo que incluye una fila por producto y por botiquín.

### Plantilla del nuevo archivo

Columnas: `kit_asset_code`, `product_code`, `product_name`, `quantity`, `unit`, `batch_code`, `expires_on`, `notes`

Ejemplo:

```text
kit_asset_code,product_code,product_name,quantity,unit,batch_code,expires_on,notes
BOT-001,ALCOHOL,Alcohol 70º,1,ud,L240115,2026-03-15,
BOT-001,AIGUA_OXIGENADA,Aigua oxigenada,1,ud,L240220,2026-05-30,
BOT-001,GASES_ESTERILS,Gases estèrils,10,ud,,2027-01-31,
```

La plantilla descargable vendrá ya rellenada con los 12 productos estándar (Alcohol, Aigua oxigenada, Antisèptic, Gases estèrils, Cotó hidròfil, Benes, Esparadrap, Apòsits adhesius, Tisores, Pinces, Guants d'un sol ús, Suero fisiològic) para un botiquín de ejemplo, de forma que solo haya que copiar el bloque y cambiar el código de botiquín. Aun así se admite cualquier otro producto: el catálogo no es cerrado.

### Reglas de validación

- `kit_asset_code` obligatorio y debe existir como activo de la empresa. Si no existe, la fila sale como error.
- `product_name` obligatorio. `product_code` opcional (si va vacío se genera a partir del nombre).
- `quantity` numérico, por defecto 1.
- `expires_on` acepta `AAAA-MM-DD` o `DD/MM/AAAA`; opcional (tisoras y pinces no caducan).
- **Duplicados: se actualizan.** Si ese producto ya existe en ese botiquín, se refrescan cantidad, unidad, lote, fecha de caducidad y notas en lugar de crear una fila nueva. Así puedes reimportar el mismo archivo después de cada revisión.

### Pantalla del botiquín

En la ficha del activo aparecerá una pestaña **Contenido del botiquín** (solo cuando el activo sea de tipo botiquín) con la lista de productos, su caducidad y un semáforo: caducado en rojo, próximo a caducar en ámbar, correcto en verde. Desde ahí se podrá añadir, editar y borrar productos a mano, sin necesidad de importar.

### Revisión en mantenimientos

Para el checklist de revisión hay dos caminos posibles. Propongo el segundo:

- Preguntas sueltas en la plantilla de checklist (una por producto). Funciona, pero hay que repetir 12 preguntas y no guarda fechas de caducidad de forma estructurada.
- **Un tipo de pregunta nueva "Revisión de botiquín"**: al abrir la sesión de mantenimiento del botiquín, el checklist despliega automáticamente los productos guardados de ese botiquín, y por cada uno se marca presente/ausente y se confirma o corrige la fecha de caducidad. Al guardar, se actualizan las caducidades reales del botiquín y se marca fallo si falta algún producto o alguno está caducado.

Esto último es una segunda fase; en esta primera entrega dejo lista la importación y la ficha de contenido.

## Detalles técnicos

- Nueva entidad `first_aid_kit_contents` en `src/lib/import/entities.ts`:
  - `loadContext` amplía a un mapa `assetCode -> assetId` y a las claves existentes `kit_asset_id + product_code`.
  - `validateRow` resuelve `kit_asset_code`, normaliza `product_code` (uppercase, sin acentos, guiones bajos), parsea `quantity` y `expires_on`.
  - Se añade estado `update` (además de `ok` / `duplicate` / `error`) para las filas que actualizan un producto existente; `insertNormalized` hace `upsert` sobre la clave (`kit_asset_id`, `product_code`).
  - Requiere un índice único en `(kit_asset_id, product_code)` — se añade vía migración junto con el `on conflict`.
- La UI de `_app.imports.tsx` ya es genérica: solo hay que añadir la nueva entrada al selector, el resumen contará también "Actualizados".
- Ficha de activo: nueva pestaña en `_app.assets.$id.tsx` con tabla CRUD sobre `first_aid_kit_contents`, visible cuando el tipo de activo tenga categoría/código de botiquín.
- Sin cambios en las políticas de acceso: la tabla ya tiene reglas por empresa.

## Fuera de alcance de esta entrega

- El tipo de pregunta "Revisión de botiquín" en los checklists de mantenimiento (segunda fase).
- Alertas automáticas de productos caducados en el panel de inicio.
