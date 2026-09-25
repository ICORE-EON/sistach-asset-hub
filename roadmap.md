# Roadmap – desacoplamiento del módulo de mantenimiento

- [x] Fase 0/1: Vitest, frontera `src/modules/maintenance`, contratos, manifest, dominio puro + tests
- [x] Fase 2: adaptadores standalone (tenant, authz, people, sites, assets, docs) + preflight + stub ICORE — esperando revisión antes de fase 3
- [ ] Fase 3: repositorios y servicios por dominio (quitar supabase.* de páginas)
  - [x] Bloque 1 activos/familias/tipos/botiquín (repo + servicio + prueba real) — esperando revisión — verificado: build prod + test cambio de organización (10 casos)
  - [x] Bloque 2 checklists  - [ ] 3 planes (hecho, pendiente de aprobación)  - [ ] 4 sesiones  - [ ] 5 incidencias  - [ ] 6 certificados
  - [ ] Verificar cambio de organización con 2 empresas (cuenta actual solo tiene 1)
- [ ] Fase 4: mover UI a `modules/maintenance/ui` sin cambios visuales
- [ ] Fase 5: migraciones M1–M7 (org_id, FKs compuestas, tablas de relación, outbox)
- [ ] Fase 6: person_ref + actor_snapshot, document_version_ref
- [ ] Fase 7: seguridad (host_has_perm, RPC cierre/reapertura, QR con caducidad y límite)
- [ ] Fase 8: línea base limpia para ICORE
- [ ] Fase 9: paquete de exportación
- Bloqueado (decisiones ICORE): permisos como función SQL, auth.users compartido, motor de importación/firma, prefijo `mnt_` vs esquema

## Corrective fix for phases 0–1 (done)
- [x] Startup error "Uncaught undefined" fixed (auth listener filtered to identity changes; active company read after hydration; breadcrumb nested <li>)
- [x] Decisions resolved: SQL permissions (host_has_perm), identity via person_ref, mnt_ prefix in public
- [ ] Phase 2 — waiting for user authorization
