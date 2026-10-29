-- QR operativo — recorrido funcional completo con datos sintéticos (Asset Guardian).
-- Todo ocurre en UNA transacción que SIEMPRE se revierte (RAISE EXCEPTION final): empresa, activos, plan,
-- checklist, sesión, asignaciones, ejecuciones, excepción, cierre y certificado son ficticios y no quedan.
-- Actores: tres cuentas existentes usadas solo como identidades dentro de la empresa sintética.
--   SUP = manager (mnt.run + mnt.close), OPA = employee asignado (solo mnt.run), OPB = employee NO asignado;
--   después OPB pasa a ser administrador de OTRA empresa sintética sin pertenencia a la primera.
DO $run$
DECLARE
  SUP constant uuid := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  OPA constant uuid := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  OPB constant uuid := 'bacbcc08-a48e-4138-915d-6fa76c4c38bb';
  CA constant uuid := '00000000-0000-4000-8000-00000000qa01';
BEGIN
  RAISE EXCEPTION 'placeholder';
END
$run$;
