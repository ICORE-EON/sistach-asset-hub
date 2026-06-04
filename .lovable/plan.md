
# Plantillas de certificado + generación de PDF

## Objetivo

Permitir definir un **modelo de certificado por plan de mantenimiento** (con un modelo genérico de fallback) y generar automáticamente el PDF al cerrar una sesión, siguiendo el formato del ejemplo (extintores/BIE) y adaptable a otros tipos (botiquines, etc.).

## 1. Modelo de datos (migración)

Nueva tabla `certificate_templates`:

- `id`, `company_id`, `code` (único por empresa), `name`, `is_default` (bool — la plantilla genérica de la empresa).
- `title`: título del certificado (p. ej. *"Certificat de Revisió Trimestral dels Extintors"*).
- `intro_text`: párrafo introductorio con variables `{{issuer_name}}`, `{{issuer_role}}`, `{{company_name}}`, `{{company_cif}}`, `{{company_address}}`, `{{location_name}}`, `{{issued_on}}`, `{{regulation}}`.
- `regulation_text`: cita normativa (RD 513/2017, UNE, etc.).
- `columns` (jsonb): definición de columnas de la tabla de items. Cada columna `{ key, label, source }` donde `source` puede ser `asset.code`, `asset.name`, `asset_type.name`, `location.name`, `metadata.<x>`, `result`, `notes`.
- `footer_text`: texto antes de la firma.
- `show_signature`, `show_company_stamp`, `show_logo` (bools).
- `language` (`ca` / `es` / `en`), `paper_size` (`A4`).
- timestamps + `deleted_at`.

Ampliar `maintenance_plans`:
- `certificate_template_id uuid NULL` → FK a `certificate_templates`. Si null, se usa la `is_default` de la empresa; si tampoco, plantilla **built-in** hardcodeada.

RLS y GRANTs estándar (lectura para miembros, escritura para `can_manage_assets`). Seed de una plantilla genérica al crear empresa (opcional, vía función o al primer uso).

## 2. UI — gestión de plantillas

Nueva sección **"Plantillas de certificado"** en el sidebar de Sistema (solo admin/system_manager):

- `/certificate-templates` → listado (código, nombre, default, idioma, planes que la usan, acciones).
- `/certificate-templates/$id` → editor con:
  - Datos generales (código, nombre, idioma, marcar como default).
  - Editor de **título** e **introducción** con chips de variables insertables.
  - Editor de **normativa** y **pie**.
  - **Columnas de la tabla**: lista reordenable con `label` + `source` (select con las fuentes soportadas).
  - **Vista previa** en vivo con datos de ejemplo.
  - Toggles de logo / firma / sello.

En el detalle del plan (`/maintenance-plans/$id`) añadir un selector **"Modelo de certificado"** (lista de plantillas + opción *"Usar plantilla por defecto"*).

## 3. Generación de PDF al cerrar sesión

Server function `generateCertificatePdf` (`createServerFn` + `requireSupabaseAuth`):

1. Carga sesión, plan, plantilla resuelta (plan → default empresa → built-in), empresa (logo, datos), items + assets + ubicación.
2. Renderiza HTML con la plantilla (sustituye variables, monta la tabla con las columnas configuradas).
3. Convierte a PDF con **pdf-lib** (compatible con Cloudflare Workers — `puppeteer`/`chromium` están vetados en el runtime). Layout sencillo: cabecera con logo, título, párrafos, tabla, fecha+ubicación, imagen de firma, pie.
4. Sube a bucket `signed-certificates` en `company/{company_id}/cert/{cert_id}.pdf`.
5. Actualiza `certificates.pdf_url` y `pdf_hash_sha256`, y crea un `documents` con categoría `certificate_pdf` vinculado.

En `close.mutationFn` (sesión de mantenimiento), tras crear el `certificate` y los `certificate_items`, llamar a esta server fn. Si falla, el certificado queda creado sin PDF y se muestra acción **"Generar PDF"** en el detalle.

En `/certificates/$id`: botón **"Regenerar PDF"** (admin/system_manager) y **"Descargar PDF"**.

## 4. Plantilla built-in (fallback)

Definir en `src/lib/certificate-templates/default.ts` una plantilla equivalente al ejemplo adjunto pero genérica:
- Título: *"Certificado de mantenimiento"*.
- Intro: *"{{issuer_name}} | {{issuer_role}}, en representación de {{company_name}} (CIF {{company_cif}}), certifica haber realizado el mantenimiento de los siguientes equipos ubicados en {{location_name}} con el resultado indicado."*
- Columnas: Tipo, Código, Ubicación, Resultado, Observaciones.
- Pie: *"Firmado en {{location_name}}, a {{issued_on}}."*

## 5. Fuera de alcance

- Editor WYSIWYG completo (usamos campos estructurados + variables).
- Firma electrónica cualificada / sellos de tiempo.
- Plantillas por idioma múltiple en un mismo registro (una plantilla = un idioma; se duplica si hace falta).

## Técnico

- Migración: tabla `certificate_templates` + columna en `maintenance_plans` + GRANTs + RLS + policies.
- Nuevas rutas: `_app.certificate-templates.tsx` (layout), `.index.tsx`, `.$id.tsx`.
- Componente: `CertificateTemplateEditor`, `CertificatePreview`.
- Lib: `src/lib/certificate-templates/render.ts` (resolución variables + columnas), `src/lib/certificate-templates/default.ts` (built-in), `src/lib/certificate-pdf.ts` (composición pdf-lib).
- Server fn: `src/lib/certificates.functions.ts` con `generateCertificatePdf`.
- Sidebar: añadir entrada en `adminItems`.
- Cambios en `_app.maintenance.$id.tsx` (`close.mutationFn`) y `_app.certificates.$id.tsx` (botones PDF).
- Dependencia nueva: `pdf-lib` (compatible Workers).
