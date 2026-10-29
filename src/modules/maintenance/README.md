# Mantenimiento y Metrología · paquete portable

Referencia vigente: **spec/INTEGRATION_HANDOFF.md**; lista exacta: **spec/EXPORT_MANIFEST.json**.

Capas: dominio/contratos → registro de repositorios → servicios → UI. Los adaptadores traducen el almacenamiento del host; `adapters/standalone/` se excluye. No existe una capa `data` portable ni acceso directo a la base desde las pantallas.

Se exportan los instaladores SQL limpios de mantenimiento y metrología, catálogos declarativos, fichas estructuradas, sugerencias, checklists, plantillas, PDF, contratos, servicios y pantallas. No se exportan registros empresariales ni ficheros/documentos de demostración. Las fixtures son técnicas y solo de pruebas desechables, nunca seeds de negocio.

`adapters/icore/` es un **stub**: todas las operaciones rechazan, preflight false, permisos UX false. No realiza consultas a iCore ni demuestra integración. El host debe aportar rutas, estilos/kit UI, contexto por solicitud, personas/centros/permisos/documentos y repositorios reales.

`ui/pages/` contiene las pantallas; el destino crea sus envoltorios TanStack. Documentación y Administración generales pertenecen al host, no se copian. Adjuntos y documentos metrológicos se reciben por los slots `Attachments` y `RecordDocument` de `MaintenanceUiProvider`.
