# Módulo Certificados

## Objetivo

Convertir el placeholder de **Certificados** en un módulo funcional que cubra el flujo realista del MVP:

1. **Listado** filtrable de certificados emitidos.
2. **Detalle** con metadatos, items relacionados, adjuntos y descarga del PDF.
3. **Generación automática** de un certificado al cerrar una sesión de mantenimiento (1 certificado por sesión).
4. **Registro manual** de certificados externos (cuando lo emite un técnico externo y solo tenemos PDF).

No tocamos el módulo de incidencias ni la firma — reutilizamos lo que ya hay.

## Cambios

### 1. Listado `/certificates`

Reemplazar el placeholder por una tabla con:
- Buscador por código, título, emisor.
- Filtros: estado (`issued` / `superseded` / `revoked`), tipo (interno / externo), rango de fechas, "por caducar / caducados".
- Columnas: código, título, activo/sesión origen, emitido el, válido hasta, emisor, estado, acciones (ver / descargar).
- Botón **"Registrar certificado externo"** → abre formulario (subida de PDF + metadatos).
- Badge "caducado / por caducar" calculado en cliente desde `valid_until`.

### 2. Detalle `/certificates/$id`

- Cabecera con código, título, estado y fechas (emitido / vence).
- Bloque de **emisor** (interno = usuario actual; externo = provider + número).
- Bloque de **items cubiertos** (`certificate_items` con result y notas).
- Enlace a la sesión origen (si la hay) y a las incidencias derivadas.
- **AttachmentsPanel** con `defaultCategory="certificate_pdf"` para subir el PDF firmado y adjuntos.
- Botón **"Descargar PDF"** (descarga el archivo subido en `pdf_url` / adjunto principal).
- Acciones según rol:
  - `administrator` / `system_manager`: editar notas, revocar.
  - `auditor`: solo lectura.

### 3. Generación al cerrar sesión

En `CloseSessionDialog` (sesión de mantenimiento), después de marcar la sesión como `closed`:

- Llamar a `next_code(company_id, 'certificate', 'CERT')` para obtener el código.
- Crear un `certificates` con:
  - `title` = "Certificado de mantenimiento — {plan.name}" (o nombre genérico si no hay plan).
  - `issued_on` = hoy, `valid_until` = `issued_on + interval del plan` (si existe), si no, sin caducidad.
  - `issuer_name` = `signer_name`, `issuer_role` = `signer_role`.
  - `signature_image_url` = misma firma de la sesión.
  - `notes` con resumen ("X activos OK, Y con incidencias abiertas").
- Insertar un `certificate_items` por cada `maintenance_item` de la sesión (asset_id, maintenance_item_id, maintenance_session_id, result derivado).
- Toast con enlace al detalle del certificado.

Si la sesión se reabre y se vuelve a cerrar, se emite un certificado nuevo (no se reemplaza el anterior) — el viejo queda como `issued` igualmente; la revocación es manual.

### 4. Registro de certificado externo

Diálogo con:
- Título, emisor (nombre y rol), proveedor externo, número externo.
- Fechas emitido / válido hasta.
- Selección opcional de activos cubiertos → crea `certificate_items` solo con `asset_id`.
- Subida obligatoria del PDF al bucket `documents` con categoría `certificate_pdf`, vinculado al certificado.

### 5. Navegación

- Card en `/dashboard` con "Certificados emitidos este mes" y "Por caducar (30 días)".
- Enlace cruzado: en `/maintenance/$id` cerrado, mostrar enlace al certificado generado.

## Técnico

- Rutas nuevas:
  - `src/routes/_authenticated/_app.certificates.index.tsx` (listado).
  - `src/routes/_authenticated/_app.certificates.$id.tsx` (detalle).
  - Convertir `_app.certificates.tsx` en layout con `<Outlet />`.
- Componente nuevo: `src/components/external-certificate-dialog.tsx`.
- Helper nuevo: `src/lib/cert-status.ts` (cálculo de estado de caducidad).
- Lógica de generación: extender `close.mutationFn` en `CloseSessionDialog` para crear `certificates` + `certificate_items` en la misma mutación.
- **Sin migraciones**: las tablas `certificates`, `certificate_items`, los counters (`scope='certificate'`) y la RPC `next_code` ya existen.
- RLS ya cubre: `certificates_insert` exige `can_run_maintenance`; `cert_items_modify` lo mismo; `certificates_update` exige `can_manage_assets`.

## Fuera de alcance

- **Generación de PDF en el servidor** (con plantilla bonita). Por ahora el PDF lo aporta el usuario (subida manual) o se omite. Lo abordaremos como mejora posterior cuando definamos plantilla y branding.
- Numeración personalizable por empresa (usa el formato estándar `CERT-YYYY-NNNN`).
- Firma electrónica avanzada / sellos cualificados.
