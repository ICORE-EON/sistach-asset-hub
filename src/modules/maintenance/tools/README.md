# Repetir la verificación y el sellado

Desde la raíz del repositorio de origen:

```sh
bash src/modules/maintenance/sql/__tests__/run.sh
bunx vitest run src/modules/maintenance
python3 src/modules/maintenance/tools/export-package.py --manifest
python3 src/modules/maintenance/tools/export-package.py --seal /tmp/mnt-release
python3 src/modules/maintenance/tools/export-package.py --verify /tmp/mnt-release/<archivo>.zip
```

Extraer ZIP a una raíz limpia, comprobar `sha256sum -c SHA256SUMS` y ejecutar desde **esa raíz**, con dependencias de pruebas resueltas (no incluidas en ZIP):

```sh
bunx vitest run --config src/modules/maintenance/tools/vitest.export.config.ts
```

Tests host-bound del standalone se excluyen explícitamente en manifiesto; los de wrappers de esta app se omiten en exportación sin rutas. Los cuatro tests live requieren host real y no se presentan como aprobados. La configuración exportada no lleva alias de esta app ni paquetes privados del host.

Build y typecheck se verifican separadamente en el destino con su configuración real. En Lovable el entorno ejecuta ambos automáticamente y prohíbe invocación manual; `build-errors.log` solo demuestra build, no un typecheck independiente si no hay su evidencia. Ver VALIDATION_FINAL.md.

El exportador no lee variables de entorno ni la base de datos. El SHA de payload identifica las sumas por archivo; el SHA externo identifica el ZIP entero. No modificar un archivo después de sellar; volver a sellar crea otro SHA/nombre. Fixtures históricas son testOnly; jamás ejecutarlas contra negocio como rollback.