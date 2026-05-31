# Auto-incidencias al cerrar un activo con fallos

## Diagnóstico

Hoy, al pulsar **"Guardar con fallos"** en un activo de la sesión (`src/routes/_authenticated/_app.maintenance.$id.tsx → completeItem`), el código:

1. Lee las respuestas desde la caché de React Query (`responses`).
2. Filtra las que tienen `is_fail = true` **y** cuya pregunta tiene `creates_incident = true`.
3. Crea una incidencia por cada una.

Esto produce dos huecos por los que las incidencias pueden no aparecer:

- **A. Caché desactualizada.** El botón usa `responses` cacheadas; si la última respuesta aún no se ha re-fetcheado, no se contabiliza como fallo y no se crea incidencia (ni se marca el activo como "with_incident").
- **B. `creates_incident = false` en la pregunta.** Si en la plantilla esa casilla no está marcada, jamás se crea incidencia aunque el técnico marque el fallo. Esto es por diseño, pero hoy no se comunica en la UI, así que el usuario percibe un bug.

## Cambios propuestos (solo frontend del módulo de mantenimiento)

### 1. Recalcular fallos contra la base de datos en el cierre del activo
En `completeItem.mutationFn`, antes de decidir resultado e incidencias:

- Hacer un `select` fresco de `checklist_responses` filtrado por `maintenance_item_id`.
- Calcular `anyFail` y `failedWithIncident` con esos datos (no con la caché).
- Mantener la deduplicación actual por `source_response_id`.

Esto elimina el race condition entre `saveResponse` (upsert) y el clic inmediato en "Guardar con fallos".

### 2. Forzar el resultado correcto del activo
Sustituir la decisión actual `anyFail ? "fail" : "ok"` en el `onClick` por una decisión **derivada del resultado del paso 1**. El handler pasa solo la intención (`complete` / `na`); la mutación decide `with_incident` vs `ok` según el `select` fresco.

### 3. Aviso visible cuando una pregunta no genera incidencia
En `QuestionInput`, cuando `response?.is_fail === true` **y** la pregunta tiene `creates_incident = false`, mostrar un texto pequeño junto al badge "Falla":

> "Esta pregunta no abre incidencia automáticamente (configurable en la plantilla)."

Así el técnico entiende por qué un fallo puntual no aparece luego en `/incidents`.

### 4. Toast informativo al cerrar el activo con fallos
Cuando `completeItem` cree N incidencias, el `toast.success` debe decir, por ejemplo:

> "Activo guardado con 2 incidencias abiertas."

Si hay fallos pero ninguna pregunta tenía `creates_incident`, el toast indica:

> "Activo guardado con fallos. Ninguna pregunta del checklist está configurada para abrir incidencia."

## Fuera de alcance

- No se toca el módulo de **Certificados** (sigue placeholder); cuando lo construyamos definiremos su relación con incidencias.
- No se modifica el trigger de notificaciones ni el esquema de BD.
- No se cambia el flujo de cierre de sesión (la firma) — los activos siguen necesitando estar completados antes.

## Archivos a tocar

- `src/routes/_authenticated/_app.maintenance.$id.tsx` (lógica de `completeItem`, `QuestionInput` y toasts).