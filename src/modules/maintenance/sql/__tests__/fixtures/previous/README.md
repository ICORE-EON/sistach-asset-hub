# Baseline de actualización congelada

Copias literales mediante `git show` del commit `c15a30cf34e2ffc1e45ca2be14189d28359fff48`, nunca generadas recortando instaladores actuales. Solo pruebas en PostgreSQL desechable, no instalación productiva ni rollback.

- install_v1.sql SHA-256: `9cbd09dcf7ee6fa0011a99a293208a007a474740783567c84e391d55ce645ac0`
- install_metrology_v1.sql SHA-256: `2d71d966eae70ba8f3097531d8a871c536fee5680cf3de23907ded96cd2f8030`

El baseline ya incluye identidad física `asset_id`, pero no asociación operativa `parent_asset_id`. El harness conserva huellas del plan y equipo original tras aplicar SQL actual. No demuestra upgrades arbitrarios ni migración de esquema standalone.