## Diagnóstico

He revisado el certificado que estás viendo (`CERT-2026-0005`) y los datos en la base de datos. Lo que está pasando:

**1. Por qué no sale la normativa en el PDF**

La plantilla que editaste ("Certificado revisión trimestral extintores") **no está asignada a este certificado**. Motivos:
- El plan de mantenimiento de la sesión no tiene plantilla asignada (`certificate_template_id` está vacío).
- Tu plantilla no está marcada como "Plantilla por defecto de la empresa" (`is_default = false`).

Por eso el generador cae al tercer nivel del fallback y usa la plantilla genérica integrada (`DEFAULT_CERTIFICATE_TEMPLATE`), que tiene `regulation_text` vacío. El código de PDF sí pinta la normativa correctamente — simplemente la plantilla efectiva no tiene texto.

La vista previa que ves dentro del editor sí usa tu plantilla con su normativa, por eso parece que "funciona en preview pero no en PDF".

**2. Por qué no sale el logo**

- Tu plantilla no tiene logo subido (`logo_url` vacío en `certificate_templates`).
- La empresa tampoco tiene logo (`companies.logo_url` vacío).
- **Y efectivamente no existe ninguna UI para subir el logo de la empresa** todavía. El campo existe en BD pero no se expone en Ajustes ni en onboarding. La única forma actual es el subidor por plantilla en el editor de plantillas.

## Plan

### A. Hacer que la plantilla correcta se aplique al certificado

Sin tocar la lógica de fallback, mejorar la UX para que el usuario vea qué plantilla se usará y pueda corregirlo en un clic:

1. **Listado de plantillas (`_app.certificate-templates.index.tsx`)**: añadir un aviso visible cuando ninguna plantilla esté marcada como predeterminada ("Ninguna plantilla está marcada como predeterminada de la empresa — los certificados sin plantilla específica usarán la genérica integrada").

2. **Detalle de certificado (`_app.certificates.$id.tsx`)**: mostrar qué plantilla se ha resuelto para ese certificado (plan / por defecto / genérica integrada) y un enlace para ir a editarla o cambiarla.

3. **Solución inmediata para tu caso**: marcar tu plantilla actual como `is_default = true` (lo puede hacer el propio usuario desde el editor con el checkbox que ya existe), o asignarla al plan de mantenimiento desde el detalle del plan. Después → **Regenerar PDF** desde el detalle del certificado.

### B. Subida del logo de empresa

Añadir un bloque "Logo de la empresa" en **Ajustes** (`_app.settings.tsx`):

- Tarjeta con vista previa del logo actual (firmando URL del bucket `company-logos`).
- Botón "Subir logo" (PNG/JPG, máx. 2 MB) → sube a `company-logos` con ruta `{company_id}/company-logo.{ext}` y actualiza `companies.logo_url`.
- Botón "Quitar logo".
- Permisos: solo `administrator` / `system_manager`.
- Reutilizar el patrón del `LogoCard` que ya existe en el editor de plantillas.

El generador de PDF ya tiene el fallback `template.logo_url → company.logo_url`, así que en cuanto subas el logo de empresa aparecerá en cualquier certificado cuya plantilla tenga `show_logo = true` y no tenga logo propio.

### C. (Opcional, recomendado) Confirmar el flujo

Después de los cambios, te indico los pasos exactos para que el certificado actual salga correcto:
1. Subir logo de empresa en Ajustes.
2. Marcar tu plantilla como predeterminada (o asignarla al plan).
3. Pulsar **Regenerar PDF** en el certificado.

## Detalles técnicos

- **Sin migraciones**: `companies.logo_url` ya existe.
- **Bucket**: reutilizar `company-logos` (mismo que las plantillas). La ruta `{company_id}/company-logo.{ext}` es compatible con la policy existente que filtra por `company_id` como primer segmento.
- **Archivos a tocar**:
  - `src/routes/_authenticated/_app.settings.tsx` — añadir `CompanyLogoCard`.
  - `src/routes/_authenticated/_app.certificates.$id.tsx` — mostrar plantilla resuelta + aviso.
  - `src/routes/_authenticated/_app.certificate-templates.index.tsx` — aviso "no hay predeterminada".
- **Sin cambios** en `certificate-pdf.ts` ni en `certificate-generator.ts` — la lógica ya es correcta.

## Fuera de alcance

- Cambiar el orden del fallback de plantillas.
- Migrar plantillas existentes para marcar una como predeterminada automáticamente.
- Editor visual de la posición/tamaño del logo en el PDF.
