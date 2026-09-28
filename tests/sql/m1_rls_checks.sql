-- Fase 5 · M1 — pruebas de RLS y FK compuestas por perfil, con datos reales.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Tokens: :CA/:CB empresas, :TA/:TB plantillas, :LA/:LB centros, :PA/:PB planes,
-- :GT tipo global, :CT tipo propio de B creado solo para la prueba, :IT ítem de A.
BEGIN;
INSERT INTO public.asset_types(id, company_id, code, name_i18n, category)
VALUES ('00000000-0000-4000-8000-00000000c7b1', 'f80df1ea-1d54-43f1-9330-e35d277c91a6', 'M1TEST', '{}', 'other');

CREATE TEMP TABLE m1_res(n int, actor text, test text, expected text, got text);

DO $run$
DECLARE
  r record; v text; c bigint; q text;
  UA constant text := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  UB constant text := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  UN constant text := 'bacbcc08-a48e-4138-915d-6fa76c4c38bb';
BEGIN
  FOR r IN SELECT * FROM (VALUES
  -- n, actor, uid, role, kind, expected, sql
  (1,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_checklist_template_types VALUES (':CA',':TA',':GT')$$),
  (2,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_checklist_template_sites VALUES (':CA',':TA',':LA')$$),
  (3,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_plan_sites VALUES (':CA',':PA',':LA')$$),
  (4,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES (':CA',':GT')$$),
  (5,'admin A','A','authenticated','count','rows:4',$$SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_plan_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types$$),
  (6,'admin A','A','authenticated','rows','rows:1',$$UPDATE public.mnt_org_asset_types SET enabled=false WHERE org_id=':CA'$$),
  (7,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_org_asset_types SET asset_type_id=':CT' WHERE org_id=':CA'$$),
  (8,'admin A','A','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES (':CA',':CT')$$),
  (9,'admin A','A','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_checklist_template_types VALUES (':CA',':TA',':CT')$$),
  (10,'admin A','A','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_checklist_template_sites VALUES (':CA',':TA',':LB')$$),
  (11,'admin A','A','authenticated','exec','rej:42501',$$DELETE FROM public.mnt_org_asset_types WHERE org_id=':CA'$$),
  (12,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_checklist_template_types SET org_id=org_id$$),
  (13,'admin A','A','authenticated','rows','rows:1',$$DELETE FROM public.mnt_plan_sites WHERE plan_id=':PA'$$),
  (14,'admin B','B','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_checklist_template_types WHERE org_id=':CA' UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites WHERE org_id=':CA' UNION ALL SELECT 1 FROM public.mnt_org_asset_types WHERE org_id=':CA'$$),
  (15,'admin B','B','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_plan_sites VALUES (':CA',':PA',':LA')$$),
  (16,'admin B','B','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_checklist_template_sites VALUES (':CB',':TA',':LB')$$),
  (17,'admin B','B','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_plan_sites VALUES (':CB',':PA',':LB')$$),
  (18,'admin B','B','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_plan_sites VALUES (':CB',':PB',':LA')$$),
  (19,'admin B','B','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES (':CA',':GT')$$),
  (20,'admin B','B','authenticated','rows','rows:0',$$DELETE FROM public.mnt_checklist_template_types WHERE org_id=':CA'$$),
  (21,'admin B','B','authenticated','rows','rows:0',$$UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id=':CA'$$),
  (22,'admin B','B','authenticated','exec','ok',$$INSERT INTO public.mnt_plan_sites VALUES (':CB',':PB',':LB')$$),
  (23,'admin B','B','authenticated','exec','ok',$$INSERT INTO public.mnt_checklist_template_types VALUES (':CB',':TB',':CT')$$),
  (24,'sin empresa','N','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_plan_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types$$),
  (25,'sin empresa','N','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_checklist_template_sites VALUES (':CA',':TA',':LA')$$),
  (26,'sin empresa','N','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES (':CA',':GT')$$),
  (27,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_checklist_template_types$$),
  (28,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_checklist_template_sites$$),
  (29,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_plan_sites$$),
  (30,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_org_asset_types$$),
  (31,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_outbox$$),
  (32,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_migration_runs$$),
  (33,'anon','-','anon','exec','rej:42501',$$INSERT INTO public.mnt_plan_sites VALUES (':CA',':PA',':LA')$$),
  (34,'admin A','A','authenticated','count','rej:42501',$$SELECT 1 FROM public.mnt_outbox$$),
  (35,'admin A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_outbox(org_id,event_type,aggregate_type,aggregate_id) VALUES (':CA','x','x',':CA')$$),
  (36,'admin A','A','authenticated','count','rej:42501',$$SELECT 1 FROM public.mnt_migration_runs$$),
  (37,'@employee','A','-','exec','ok',$$UPDATE public.company_members SET role='employee' WHERE user_id=':UA'$$),
  (38,'empleado A','A','authenticated','count','rows:3',$$SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types$$),
  (39,'empleado A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_plan_sites VALUES (':CA',':PA',':LA')$$),
  (40,'empleado A','A','authenticated','rows','rows:0',$$DELETE FROM public.mnt_checklist_template_types WHERE org_id=':CA'$$),
  (41,'empleado A','A','authenticated','rows','rows:0',$$UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id=':CA'$$),
  (42,'@sysmgr','A','-','exec','ok',$$UPDATE public.company_members SET role='system_manager' WHERE user_id=':UA'$$),
  (43,'resp. sistema A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_plan_sites VALUES (':CA',':PA',':LA')$$),
  (44,'resp. sistema A','A','authenticated','rows','rows:0',$$UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id=':CA'$$),
  (45,'resp. sistema A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES (':CA','3322b44f-cce2-4d93-9322-d03523adc7b4')$$),
  (46,'sin FK (brecha M4)','-','-','exec','ok',$$UPDATE public.maintenance_items SET company_id=':CB' WHERE id=':IT'$$),
  (47,'propietario','-','-','exec','ok',$$UPDATE public.maintenance_items SET company_id=':CA' WHERE id=':IT'$$),
  (48,'propietario','-','-','exec','ok',$$INSERT INTO public.certificate_items(certificate_id, result) SELECT certificate_id, 'na' FROM public.certificate_items LIMIT 1$$),
  (49,'sin FK (brecha M4)','-','-','exec','ok',$$UPDATE public.maintenance_plans SET checklist_template_id=':TB' WHERE id=':PA'$$),
  (50,'sin FK (brecha M4)','-','-','exec','ok',$$UPDATE public.assets SET location_id=':LB' WHERE company_id=':CA'$$),
  (51,'propietario','-','-','exec','rej:23503',$$INSERT INTO public.mnt_checklist_template_types VALUES (':CA',':TA',':CT')$$),
  (52,'propietario','-','-','exec','ok',$$UPDATE public.assets SET name=name WHERE company_id=':CA'$$)
  ) t(n, actor, who, role, kind, expected, sql) ORDER BY n
  LOOP
    q := replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(r.sql,
      ':CA','e5b35c19-afd3-4675-9654-070e8a8ffc7d'), ':CB','f80df1ea-1d54-43f1-9330-e35d277c91a6'),
      ':TA','65203ff4-a756-40a4-a018-6c24b1f54152'), ':TB','4f76f59e-8dba-462b-892c-b918aa73bfb6'),
      ':LA','be3b894e-1bd1-4b44-940c-ded3ee4909e8'), ':LB','e676ae41-2a82-422c-88a8-18d87805f0f1'),
      ':PA','51d28637-6c89-40a9-9602-69bc0343e852'), ':PB','8dadaa50-3117-40e4-b7d1-7aafe7c0521e'),
      ':GT','6d37ba20-ea6f-4582-bdb8-0b115fad874a'), ':CT','00000000-0000-4000-8000-00000000c7b1'),
      ':IT','785b092d-7fff-4272-87de-ae7415464f9d');
    q := replace(q, ':UA', UA);
    PERFORM set_config('request.jwt.claims', CASE r.who
      WHEN 'A' THEN json_build_object('sub', UA, 'role', 'authenticated')::text
      WHEN 'B' THEN json_build_object('sub', UB, 'role', 'authenticated')::text
      WHEN 'N' THEN json_build_object('sub', UN, 'role', 'authenticated')::text
      ELSE '{"role":"anon"}' END, true);
    BEGIN
      IF r.role <> '-' THEN EXECUTE format('SET LOCAL ROLE %I', r.role); END IF;
      IF r.kind = 'count' THEN EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; v := 'rows:' || c;
      ELSIF r.kind = 'rows' THEN EXECUTE q; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:' || c;
      ELSE EXECUTE q; v := 'ok'; END IF;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v := 'rej:' || SQLSTATE;
    END;
    RESET ROLE;
    INSERT INTO m1_res VALUES (r.n, r.actor, left(r.sql, 70), r.expected, v);
  END LOOP;
END
$run$;

SELECT n, actor, expected, got, CASE WHEN expected = got THEN 'PASA' ELSE 'FALLA' END AS res, test
FROM m1_res ORDER BY n;
ROLLBACK;
