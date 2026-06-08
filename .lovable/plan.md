
# Mejoras al certificado PDF

## 1. Texto de "Normativa / texto adicional" en el PDF

El renderizador ya pinta `regulation_text` entre la introducción y la tabla, pero queda como un párrafo pequeño y discreto. Lo haremos más visible:

- Mismo tamaño que la introducción (10 pt) en lugar de 9 pt.
- Etiqueta opcional en negrita encima ("Normativa aplicable:") si el texto no empieza ya por mayúsculas largas.
- Margen vertical mayor antes y después para separarlo bien de la tabla.

Cambio aislado en `src/lib/certificate-pdf.ts` (función `buildCertificatePdf`).

## 2. Tabla de incidencias detectadas

Tras la tabla de equipos revisados, añadir un bloque **"Incidencias detectadas"** con las incidencias abiertas/cerradas durante la sesión que generó el certificado.

**Datos:** se cargan las incidencias cuyo `source_maintenance_item_id` pertenece a algún item de la sesión, o cuyo `asset_id` está en la lista de activos revisados de ese certificado y `created_at >= session.started_at`. En la práctica: tomar `incidents` con `source_maintenance_item_id IN (maintenance_items de la sesión)` — es el caso natural ya que se crean al cerrar la sesión.

**Columnas fijas** (no configurables, simplifican el modelo):
- Tipo de activo
- Código del activo
- Ubicación
- Severidad (badge textual)
- Descripción de la incidencia

Si no hay incidencias, se omite el bloque por completo (no se pinta el título).

**Cambios:**
- `src/lib/certificate-generator.ts`: nueva consulta a `incidents` filtrando por los `maintenance_items` de la sesión del certificado; pasar `incidents[]` a `buildCertificatePdf`.
- `src/lib/certificate-pdf.ts`: nueva sección con título "Incidencias detectadas" + tabla con columnas predefinidas, reutilizando el helper `drawTable` (con un mapeo aparte que no usa `TemplateColumn`).
- Vista previa del editor (`_app.certificate-templates.$id.tsx`): mostrar un bloque de incidencias de ejemplo para que el usuario vea cómo queda.

## 3. Logo por plantilla

Añadir un logo propio a cada plantilla. Se usa como prioridad sobre el logo de la empresa:

1. `template.logo_url` si está definido.
2. `company.logo_url` si la plantilla tiene `show_logo = true` y no tiene logo propio.
3. Nada.

**Cambios de datos** (migración):
- `ALTER TABLE certificate_templates ADD COLUMN logo_url text NULL`.

**Storage:** se reutiliza el bucket `company-logos` con ruta `{company_id}/templates/{template_id}.{ext}` (mismas policies, ya validan `company_id`).

**UI** en el editor de plantilla:
- Nueva sección "Logo del certificado" debajo de "Datos generales".
- Vista previa del logo actual (signed URL) + botón **Subir logo** (`input file`, imágenes png/jpg, max ~1 MB) + botón **Quitar logo**.
- El checkbox "Mostrar logo" se mantiene y controla si se imprime cualquier logo (propio o de empresa).

**Generador** (`certificate-generator.ts`): resolver `logoUrl` primero desde `template.logo_url` (signed URL), si null y `show_logo`, caer al `company.logo_url`.

## Fuera de alcance

- Reordenar la posición del bloque de incidencias o el de equipos (queda fijo: equipos → incidencias).
- Editor visual de la tabla de incidencias (columnas fijas).
- Migrar plantillas existentes para añadir un logo automáticamente.

## Técnico (resumen de archivos)

- Migración: `ALTER TABLE certificate_templates ADD COLUMN logo_url text`.
- `src/lib/certificate-templates/types.ts`: añadir `logo_url?: string | null`.
- `src/lib/certificate-pdf.ts`: render más visible de normativa + sección de incidencias; aceptar `incidents` y `templateLogoUrl` en input.
- `src/lib/certificate-generator.ts`: cargar incidencias de la sesión, resolver logo (plantilla → empresa).
- `src/routes/_authenticated/_app.certificate-templates.$id.tsx`: UI de subir/quitar logo + preview con bloque de incidencias de ejemplo.
- Persistir `logo_url` en el `update` de la mutación de guardar.
