# Decisiones que solo pueden tomarse dentro del ICORE real

1. Mapeo físico de organización, persona, centro y documento (tablas/servicios reales) para las funciones `host_*`.
2. Si `host_has_perm` se apoya en roles, grupos o políticas existentes de ICORE, y quién asigna los permisos `mnt.*`.
3. Esquema de destino: `public` con prefijo `mnt_` (decidido) frente a convenciones propias de ICORE.
4. Dónde se genera el PDF (cliente con pdf-lib o servicio de ICORE) y dónde se recalcula el SHA-256.
5. Transporte, retención y consumidor de `mnt_outbox`.
6. Baja/purga de organizaciones frente al historial inmutable.
7. Registro de activos compartido (AssetPort) frente a activos propios del módulo.
8. Caducidad de tokens QR y URL firmadas; datos de contexto de firma (IP, agente).
9. Sistema i18n para `name_i18n` y kit UI equivalente a `@/components/ui/*`.
10. Tipos globales que activa cada organización (nunca automático).
