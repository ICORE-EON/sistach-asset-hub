# Módulo de mantenimiento (portable)

Capas: `domain` (reglas puras, sin I/O) → `data` (único sitio con supabase.*) → `services` (casos de uso) → `ui`.
`contracts` define los puertos del host; `adapters/standalone` los implementa sobre esta app y `adapters/icore` sobre ICORE.
`host-manifest.json` declara los prerrequisitos del host. Ver el plan archivado en `.lovable/plan/`.
