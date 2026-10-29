# INTEGRATION HANDOFF · Mantenimiento y Metrología

## Estado y revisión exacta
Entrega técnica para implementar posteriormente el adaptador **en la cuenta/proyecto iCore**. No se ha integrado, consultado, publicado ni desplegado iCore. No se cambian funcionalidades, navegación ni datos actuales.

Commit base de esta preparación: `6c25b606427eee0d9836fc62ccec7f3cbee959c9`. **No es un commit de los cambios finales**: la revisión exacta e inmutable del paquete es su `payloadSha256` en `PACKAGE_RECEIPT.json` y el SHA-256 externo del ZIP. `SHA256SUMS` cubre cada archivo de `EXPORT_MANIFEST.json`, incluido este handoff. El recibo y las sumas son un sobre externo al payload para evitar hashes autorreferenciales. Un cambio de un byte exige generar otro paquete/SHA; no reemplazar una entrega ya sellada.

Manifiesto v2 y `contracts/export-operations.ts`: **143 operaciones**: activos 27, checklists 15, planes 15, sesiones 17, incidencias 11, certificados 26, correctivos 8, metrología 24. El archivo base `operations.ts` mantiene sus 111 operaciones por compatibilidad. Las capacidades del **adaptador real** están false en el manifiesto. El stub exportado expone y rechaza las 143 llamadas; no es una implementación funcional.

## Inventario funcional exportado
- Activos: inventario, familias/tipos, categorías conceptuales, ficha, ámbito por centros, búsqueda, retirada/eliminación elegible y botiquín.
- Biblioteca reutilizable: nueve familias, 51 tipos (15 opcionales), fichas técnicas estructuradas declarativas, selector de instrumentos catálogo/Otro/legado, 37 recomendaciones revisables sin programación automática, checklists/versiones/preguntas y plantillas de certificado/PDF. Se conserva contenido en código/seeds técnicos, **no** plantillas/checklists creados como registros demo de esta app.
- Mantenimiento: planes/ámbitos, clasificación descriptiva, interno/externo, Próximos/Histórico/Planes, vencimientos persistidos por vínculo y decisiones de cierre/bitácora, snapshots, sesiones/resultados/incidencias/certificados y borrado seguro 2A.
- Correctivos: reparaciones sin plan, actuaciones append-only, edición descriptiva con token de concurrencia, cancelación con motivo, cierre y reactivación explícita independiente.
- Metrología: equipos/planes de control, borradores/líneas, validación/rectificación, Apto/No apto/Restringido, impacto/decisiones, centros/historial, etiquetas QR, documentos y visor de versiones. Ocho tablas y motor SQL portable.
- Relación física opcional `asset_id` 1:1 y principal `parent_asset_id` N:1 independientes, misma org, sin reasignación silenciosa, RESTRICT. Creación asociada reutiliza formulario sin activo implícito; identidad comparte nombre/código/ubicación; instrumento independiente conserva nombre propio. Tarjeta de activo separa instrumentos asociados y control del propio activo, sin segunda ficha.
- Contratos/DTO, servicios, contexto UI por solicitud, PDF, SQL/RLS/RPC/outbox, stub iCore y pruebas exportables. `adapters/standalone/` excluido: permanece operativo exclusivamente en esta app.

## Fuentes de verdad previstas en iCore (solo documentación)
No se ha leído el esquema del destino, ni se presume una columna, relación o consulta.

| Autoridad | Tablas previstas del host |
|---|---|
| Organizaciones | `organizations` |
| Centros | `org_sites` |
| Personas y puestos | `people`, `positions`, `position_assignments` |
| Documentos/versiones | `documents`, `document_versions` |
| Acciones | `management_actions` |
| Estructura del sistema | `mgmt_families`, `mgmt_element_catalog`, `mgmt_elements`, `mgmt_components` |
| Planificación/roadmap/revisiones | `mgmt_plans`, `mgmt_plan_status`, `mgmt_reviews` |
| Normativa | vínculos normativos estructurados del catálogo, **nunca texto libre como autoridad** |

**Decisión de integración pendiente en destino:** el instalador de referencia contiene almacenamiento operativo `mnt_*` (catálogos, planes, sesiones e incidencias propios). El adaptador debe acordar mapeos/proyecciones/referencias con las autoridades anteriores sin crear fuentes de verdad paralelas; el paquete no implementa ese mapeo ni inventa el esquema. `mnt_orgs` es registro técnico de referencias/timezone, no otra organización maestra. Textos existentes de normativa/plantillas son descripciones legadas, no acreditación legal ni enlaces normativos canónicos.

## Dependencias y contratos del host
Firmas exactas: HOST_CONTRACTS.md; DTO_MAPPING.md explica traducciones, no tablas del host nuevas.

1. PostgreSQL ≥15, UUID, roles `anon`, `authenticated`, `service_role` (privilegiado), `auth.uid()` derivada de sesión.
2. `public.host_has_perm(uuid,text) RETURNS boolean`, `host_person_ref() RETURNS uuid`, `host_person_snapshot(uuid) RETURNS jsonb`, `host_site_in_org(uuid,uuid) RETURNS boolean`, `host_document_version_sha(uuid,uuid) RETURNS text`. Permisos fail-closed, identidad no suministrada por cliente; permisos UX nunca sustituyen RLS/RPC.
3. Puertos `TenantPort`, `AuthzPort`, `PeoplePort`, `SitePort`, `AssetPort`, `DocumentPort`; repositorios reales de las ocho capacidades. Contexto explícito org/persona por llamada, DTOs anidados, códigos/estados/localización y paginación completa donde exige el contrato.
4. React 19, TanStack Router/Query, kit `@/components/ui/*`, utilidades `@/lib/utils`, estilos semánticos y alias `@`. Dependencias completas en manifiesto. El paquete no lee env ni transporta credenciales.
5. `MaintenanceUiProvider` por árbol/solicitud con request, `Attachments`, `RecordDocument` (necesario para documentos metrológicos completos); disabled permite abrir, no subir/quitar. Host aporta almacenamiento/versiones/URLs autorizadas, logos y certificados con SHA servidor.
6. Protección documental transaccional en eliminación de activos/planes/borradores/evidencias; el SQL de referencia no conoce tablas documentales del host. Consumidor idempotente outbox/event_id, retención y reintentos en destino.
7. Generación del código MTR en el adaptador: SQL requiere code; `mnt_next_code` no se invoca automáticamente en alta metrológica. No activar la capacidad hasta resolverlo.

## Orden exacto · instalación limpia de referencia
En **staging del destino**, no en la BD de esta app ni directamente en producción:

1. Verificar SHA externo del ZIP, extraer, ejecutar `sha256sum -c SHA256SUMS`; validar archivo/manifest con herramienta exportada. No extraer/ejecutar testOnly como instalación.
2. Acordar autoridad/mapeos anteriores, permisos y proveedor documental; preparar contratos SQL reales/roles/auth y backup previo del host. **No usar host_stub.sql**.
3. `psql -X -v ON_ERROR_STOP=1 "$ICORE_STAGING_DSN" -f src/modules/maintenance/sql/install_v1.sql`.
4. `psql -X -v ON_ERROR_STOP=1 "$ICORE_STAGING_DSN" -f src/modules/maintenance/sql/install_metrology_v1.sql` (si se instalará Metrología; depende de 3).
5. Catálogo reusable opcional, en orden: `seed_catalog_v1.sql`, después `seed_inventory_v2.sql`; mismos argumentos psql. Idempotentes, no sobrescriben ni activan tipos. Ningún seed de recomendaciones/planes demo.
6. Host registra org autorizada con `mnt_register_org(uuid)` bajo autoridad privilegiada; fija timezone y activa tipos explícitamente. No copiar organizaciones/demo.
7. Implementar repositorios/puertos reales **en iCore**, correr aceptación con dos org y roles reales, registrar un adaptador al arrancar; hasta entonces stub/capacidades false.
8. Montar provider/rutas/slots/estilos del host y consumidor outbox. Verificar UI/E2E antes de habilitar; decidir recolocación de configuración/documentación en destino.

Cada script SQL tiene su propia transacción; **el conjunto no es una sola transacción**. Si falla el add-on, el core exitoso permanece. No pasar `psql --single-transaction` a scripts con BEGIN/COMMIT propios.

## Orden exacto · actualización soportada
Baseline verificada: commit **`c15a30cf34e2ffc1e45ca2be14189d28359fff48`** de ambos SQL, conservado literalmente en `sql/__tests__/fixtures/previous/`; hashes en README de fixtures/SHA256SUMS. No una versión inventada por quitar bloques del SQL actual.

1. Inventario y copia de seguridad verificable del destino, incluidas referencias/documentos; suspender escrituras/consumidor. Comparar baseline; si difiere, detener y validar otra ruta en staging.
2. Con host real ya compatible, aplicar `install_v1.sql` **actual** con ON_ERROR_STOP.
3. Aplicar `install_metrology_v1.sql` **actual**; si el add-on no existía, esto es instalación limpia del add-on, no migración de equipos demo.
4. Opcional resembrar catálogo v1→v2. No activar tipos/crear registros automáticamente.
5. Verificar filas/huellas, RLS/RPC, metrología principal NULL en legado y unicidad; repetir instaladores para idempotencia en staging.
6. Sustituir código únicamente con adaptador real aceptado, reanudar consumidor/escrituras. Fallos ⇒ procedimiento de rollback; nunca registrar stub como funcional.

No se soporta ni ejecuta una conversión de las tablas heredadas de Sistach/standalone. M2–M7 canceladas. La prueba usa plan/equipo poblados del baseline congelado y conserva campos originales; no prueba todas las instalaciones históricas posibles.

## Documentación y Sistema/Configuración · rutas recolocables
**No hay una pantalla general portable de documentación/configuración** en el módulo. `/documents` y `/settings` son páginas de esta app, acopladas a su host, excluidas completas. Sus capacidades se identifican, no se rediseñan ni se migran:

| Ruta actual | Capacidad / responsable |
|---|---|
| `/documents` | búsqueda/categoría, descarga y vínculos de archivos; sustituir por `documents`/`document_versions` y slots/DocumentPort del host |
| `/settings` | empresa/logo, miembros/invitaciones, notificaciones y numeración; identidad/org/permisos/avisos/configuración del host, no copiar tablas ni página |
| `/asset-families`, `/asset-types` | páginas portables de biblioteca/configuración de inventario, con asistente/fichas; iCore decide ubicación y mapeo canónico |
| `/checklist-templates`, `/checklist-templates/$id` | plantillas/checklists portables |
| `/certificate-templates`, `/certificate-templates/$id` | plantillas y logos portables con almacenamiento del host |
| `/certificates`, `/certificates/$id` | certificados/evidencias, no gestor documental paralelo |
| `/assets`, `/assets/$id` | activos con tarjeta Metrología |
| `/maintenance`, `/maintenance/$id`, `/maintenance-plans`, `/maintenance-plans/$id` | hub, sesiones/correctivos y planes |
| `/metrology/equipment`, `/metrology/equipment/$id` | alta/listado/detalle y registros; deshabilitar en destino sin adaptador real |

Links del código portable mantienen estos paths TanStack; rutas wrapper del host no se exportan. iCore puede conservar aliases o cambiar su cableado en destino; **no afirmar que los paths son configurables sin ese trabajo**. QR/etiquetas: destino debe proveer la resolución pública/autorizada correspondiente (`/qr/$token` y origen); endpoint standalone excluido, política de caducidad/limites pendiente. No se traslada el shell ni el menú actual.

## Qué está probado / qué no
Resultados finales exactos y comandos: **VALIDATION_FINAL.md**. Se distinguen instalación limpia, actualización histórica, SQL/fixture persistida en conexión nueva y eliminada, Vitest de proyecto/exportado, build automático y typecheck. Host simulado SQL es una fixture de pruebas, no adaptador real. Pruebas shape/fail-closed cubren cada operación, **no comportamiento live de cada contrato**.

Metrología smoke: cluster efímero sin variables de conexión empresarial, creación/lectura con sesión técnica, dos instrumentos → un principal, COMMIT y lectura en otra conexión, RLS A/B y rechazo de asociación ajena, borrado fixture y destrucción cluster. No E2E navegador/servicios del host real.

## Límites conocidos y criterios pendientes
- Adaptador real, esquema/mapeo canónico y aceptación live de iCore pendientes por diseño. No decir «integrado» ni «listo para activar en iCore».
- Protección documental/acciones del host en borrados no implementada; bloqueo de activación hasta probar autoridad transaccional real.
- Código MTR, URLs/QR, jerarquía/personas y capacidades/rutas/slots deben resolverse en destino.
- Detalle de registro: criterios textuales/método del plan **actual**, no snapshot histórico inexistente; valores/modos/tolerancias/resultados de líneas sí son históricos.
- Algunas búsquedas cargan candidatos completos; no se mide rendimiento extremo. Incidencias/reparaciones conservan opciones reducidas (500); asociación muestra hasta 100 coincidencias.
- Sugerencia renombrada y recodificada no conserva ID persistente; clasificación/referencia no acredita norma. Factores de emisión excluidos/no contrastados; GWP existente reutilizable pero no contrastado ahora con fuentes oficiales.
- Typecheck independiente queda explícitamente sin ejecutar si el entorno lo impide; build no lo sustituye. No ocultar este criterio.

## Rollback técnico
Antes de instalar/actualizar, el **host** crea y verifica backup/restauración de staging y copia del código/contratos/configuración anteriores. Fallo de un script SQL: rollback automático de ese script (preflight probado sin residuos); scripts previos exitosos no se revierten automáticamente.

Fallo de conjunto/upgrade: detener escrituras y outbox, deshabilitar capacidades/rutas nuevas, restaurar snapshot/backup completo del destino y código/adaptador anterior coordinadamente; verificar aislamiento, documentos y consumidor antes de reabrir. No hay down-migration destructiva automática. Reaplicar SQL antiguo **no** deshace columnas/funciones nuevas ni evidencia. No borrar datos/tablas/guardas ni el histórico actual para simular rollback. El smoke elimina solo sus filas vacías en cluster técnico y destruye cluster.

## Exclusiones expresas de datos demo
Ninguna exportación/importación de organizaciones (incluidas Sistach/Toni Enterprises), personas/usuarios/puestos/membresías, centros, activos, vínculos, planes, ejecuciones/respuestas, reparaciones/actuaciones, incidencias/acciones, documentos/archivos/logos de negocio, certificados, históricos, auditoría, contadores/fechas programadas ni eventos outbox de esta app. Tampoco secretos/.env, clientes/integraciones/credenciales, migraciones heredadas o dependencias standalone.

Los tres eventos TEST 2A preexistentes no se transfieren ni modifican: no se añade protección nueva a demo ni se elude la inmutabilidad actual para borrarlos. El usuario podrá eliminar demo mediante los mecanismos autorizados del host, fuera de este empaquetado. Fixtures SQL con IDs ficticios son **solo testOnly**, no datos negocio ni seeds de instalación. Catálogos/fichas/recomendaciones/checklists/plantillas en código/seeds de biblioteca sí se preservan.

## Checklist de aceptación en iCore
- [ ] ZIP/SHA256SUMS/recibo/manifest verificados; no demo/secretos/standalone.
- [ ] Acordado mapeo sin autoridades duplicadas a todas las tablas canónicas previstas; normativa con enlaces estructurados.
- [ ] Contratos SQL reales, identidad/puestos/centros/documentos y permisos fail-closed, sin privilegios desde UI.
- [ ] Limpio y upgrade baseline en staging, backup/rollback restaurado de ensayo e idempotencia aceptados.
- [ ] 143 operaciones tipadas; sustituir stub solo por implementación probada, cobertura live/tenant por operación.
- [ ] Metrología create/read, 1:1/N:1, nombres, COMMIT/aislamiento, registros/rectificación/certificado/impacto y código MTR en host real.
- [ ] Borrado seguro con documentos/acciones del host en transacción; no cascadas históricas.
- [ ] Rutas/aliases/provider/slots/UI/PDF/QR, Documentación y Configuración recolocadas en destino y E2E real.
- [ ] Outbox idempotente/versiones/SHA y evidencias no eliminables; catálogo opcional sin alta/planes automáticos.
- [ ] Tests, build y **typecheck separados** del destino, sin marcar skip como aprobado.

**Entrega técnica congelada, integración real pendiente.** Si hay comprobación fallida o no ejecutada, se enumera en VALIDATION_FINAL.md y no se declara aceptación completa.