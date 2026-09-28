# Roadmap – desacoplamiento del módulo de mantenimiento

- [x] Fase 0/1: Vitest, frontera `src/modules/maintenance`, contratos, manifest, dominio puro + tests
- [x] Fase 2: adaptadores standalone (tenant, authz, people, sites, assets, docs) + preflight + stub ICORE — esperando revisión antes de fase 3
- [ ] Fase 3: repositorios y servicios por dominio (quitar supabase.* de páginas)
  - [x] Bloque 1 activos/familias/tipos/botiquín (repo + servicio + prueba real) — esperando revisión — verificado: build prod + test cambio de organización (10 casos)
  - [x] Correctivo final bloque 6: «Sin revisar» ≠ N/A, PDF versionado inmutable (pendiente de aprobación)
  - [x] Bloque 2 checklists  - [x] Bloque 3 planes (pendiente de aprobación)  - [x] Bloque 4 sesiones (pendiente de aprobación)  - [x] 5 incidencias (pendiente de aprobación)  - [x] 6 certificados (pendiente de aprobación)
  - [ ] Verificar cambio de organización con 2 empresas (cuenta actual solo tiene 1)
- [x] Fase 4: mover UI a `modules/maintenance/ui` sin cambios visuales (pendiente de aprobación)
- [ ] Fase 5: migraciones M1–M7
  - [x] M1 aplicada (estructura aditiva, puentes, outbox, RLS). Las 24 FK compuestas sobre tablas existentes se retiraron (ambigüedad de relaciones en las consultas); siguen las 5 de tablas puente. Pruebas RLS 52/52. Pendiente de aprobación.
  - [ ] M2/M3: sin FK compuestas; coherencia por org cubierta con preflight y postflight bloqueantes (abortan si hay referencias cruzadas o company_id incoherente)
  - [ ] M4: triggers de sincronización/validación rechazan nuevas relaciones entre organizaciones; auditoría de tablas puente (org_id) operativa ANTES de permitir escrituras
  - [ ] M5: consultas con nombres de relación explícitos
  - [ ] M6: reintroducir las 24 FK compuestas (NOT VALID → VALIDATE) tras M5, con prueba de pantallas
  - [ ] M7: según plan v2 (bloqueado por incompatibilidad de plan D7)
- [ ] Fase 6: person_ref + actor_snapshot, document_version_ref
- [ ] Fase 7: seguridad (host_has_perm, RPC cierre/reapertura, QR con caducidad y límite)
- [ ] Fase 8: línea base limpia para ICORE
- [ ] Fase 9: paquete de exportación
- Bloqueado (decisiones ICORE): permisos como función SQL, auth.users compartido, motor de importación/firma, prefijo `mnt_` vs esquema

## Corrective fix for phases 0–1 (done)
- [x] Startup error "Uncaught undefined" fixed (auth listener filtered to identity changes; active company read after hydration; breadcrumb nested <li>)
- [x] Decisions resolved: SQL permissions (host_has_perm), identity via person_ref, mnt_ prefix in public
- [ ] Phase 2 — waiting for user authorization

## Paquete limpio ICORE (plan v2)
- [x] Paso 1: contratos estables + registro de adaptador + separación del host standalone (esperando revisión)
- [x] Paso 2: esquema limpio, catálogo y pruebas en PostgreSQL desechable (esperando revisión)
- [ ] Paso 3: adaptador ICORE, ficha de requisitos y lista de exportación — pendiente de aprobación
