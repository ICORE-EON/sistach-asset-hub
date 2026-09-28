-- Pruebas RLS/estructura de M1. Todo termina en ROLLBACK: no deja datos.
BEGIN;
CREATE TEMP TABLE mnt_m1_results(n int, actor text, test text, expected text, got text) ON COMMIT DROP;
GRANT INSERT ON mnt_m1_results TO authenticated, anon;
INSERT INTO public.asset_types(id, company_id, code, name_i18n, category) VALUES ('00000000-0000-4000-8000-00000000c7b1', 'f80df1ea-1d54-43f1-9330-e35d277c91a6', 'M1TEST', '{}', 'other');
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_types VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (1, 'admin A', 'insert tipo en plantilla A', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (2, 'admin A', 'insert centro en plantilla A', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (3, 'admin A', 'insert centro en plan A', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (4, 'admin A', 'habilitar tipo global en A', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_plan_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (5, 'admin A', 'leer puentes de A', 'rows:4', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=false WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (6, 'admin A', 'deshabilitar tipo global', 'rows:1', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET asset_type_id='00000000-0000-4000-8000-00000000c7b1' WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (7, 'admin A', 'cambiar tipo de la habilitación', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','00000000-0000-4000-8000-00000000c7b1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (8, 'admin A', 'habilitar tipo de otra empresa', 'rej:23503', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_types VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','00000000-0000-4000-8000-00000000c7b1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (9, 'admin A', 'tipo de otra empresa en plantilla A', 'rej:23503', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (10, 'admin A', 'plantilla A con centro de B', 'rej:23503', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_plan_sites WHERE plan_id='51d28637-6c89-40a9-9602-69bc0343e852'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (11, 'admin A', 'borrar su propio centro de plan', 'rows:1', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' UNION ALL SELECT 1 FROM public.mnt_org_asset_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d') q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (12, 'admin B', 'leer puentes de A', 'rows:0', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (13, 'admin B', 'insert con org_id de A', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','65203ff4-a756-40a4-a018-6c24b1f54152','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (14, 'admin B', 'insert en B apuntando a plantilla de A', 'rej:23503', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','51d28637-6c89-40a9-9602-69bc0343e852','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (15, 'admin B', 'insert en B apuntando a plan de A', 'rej:23503', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (16, 'admin B', 'mover fila propia a A (org_id)', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (17, 'admin B', 'borrar puentes de A', 'rows:0', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (18, 'admin B', 'actualizar habilitación de A', 'rows:0', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','8dadaa50-3117-40e4-b7d1-7aafe7c0521e','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (19, 'admin B', 'insert válido en B', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_org_asset_types UNION ALL SELECT 1 FROM public.mnt_plan_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (20, 'sin empresa', 'leer puentes', 'rows:0', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (21, 'sin empresa', 'insert en A', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (22, 'sin empresa', 'habilitar tipo en A', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (23, 'anon', 'leer mnt_checklist_template_types', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (24, 'anon', 'leer mnt_checklist_template_sites', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_plan_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (25, 'anon', 'leer mnt_plan_sites', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (26, 'anon', 'leer mnt_org_asset_types', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_outbox) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (27, 'anon', 'leer mnt_outbox', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_migration_runs) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (28, 'anon', 'leer mnt_migration_runs', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_outbox) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (29, 'admin A', 'leer mnt_outbox', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_outbox(org_id,event_type,aggregate_type,aggregate_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','x','x','e5b35c19-afd3-4675-9654-070e8a8ffc7d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (30, 'admin A', 'escribir mnt_outbox', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_migration_runs) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (31, 'admin A', 'leer mnt_migration_runs', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_org_asset_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (32, 'admin A', 'borrar habilitación (sin política)', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_checklist_template_types SET org_id=org_id; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (33, 'admin A', 'actualizar puente inmutable', 'rej:42501', v);
END $t$;
RESET ROLE;
UPDATE public.company_members SET role='employee' WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443';
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (34, 'empleado A', 'leer puentes de A', 'rows:3', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (35, 'empleado A', 'insert centro en plan A', 'rej:42501', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (36, 'empleado A', 'borrar tipo de plantilla A', 'rows:0', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (37, 'empleado A', 'actualizar habilitación', 'rows:0', v);
END $t$;
RESET ROLE;
UPDATE public.company_members SET role='system_manager' WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443';
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (38, 'responsable sistema A', 'insert centro en plan A', 'ok', v);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (39, 'responsable sistema A', 'habilitar tipo (solo administrador)', 'rows:0', v);
END $t$;
RESET ROLE;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_items SET company_id='f80df1ea-1d54-43f1-9330-e35d277c91a6' WHERE id=('785b092d-7fff-4272-87de-ae7415464f9d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (40, 'propietario', 'ítem con company_id de B y sesión de A', 'rej:23503', v);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_items SET company_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' WHERE id=('785b092d-7fff-4272-87de-ae7415464f9d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (41, 'propietario', 'ítem con company_id de A (correcto)', 'ok', v);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN INSERT INTO public.maintenance_items(session_id, asset_id, checklist_template_version_id, result) SELECT session_id, asset_id, checklist_template_version_id, result FROM public.maintenance_items WHERE id='785b092d-7fff-4272-87de-ae7415464f9d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (42, 'propietario', 'ítem nuevo sin company_id (app actual)', 'ok', v);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_plans SET checklist_template_id='4f76f59e-8dba-462b-892c-b918aa73bfb6' WHERE id='51d28637-6c89-40a9-9602-69bc0343e852'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (43, 'propietario', 'plan de A con plantilla de B', 'rej:23503', v);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.assets SET location_id='e676ae41-2a82-422c-88a8-18d87805f0f1' WHERE company_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (44, 'propietario', 'activo de A en centro de B', 'rej:23503', v);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_sites; DELETE FROM public.mnt_plan_sites; DELETE FROM public.locations WHERE id='be3b894e-1bd1-4b44-940c-ded3ee4909e8'; IF EXISTS (SELECT 1 FROM public.assets WHERE company_id IS NULL) THEN RAISE EXCEPTION 'company_id anulado'; END IF; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  INSERT INTO mnt_m1_results VALUES (45, 'propietario', 'borrar centro de A anula solo location_id', 'ok', v);
END $t$;
SELECT n, actor, test, expected, got, CASE WHEN expected = got THEN 'PASA' ELSE 'FALLA' END AS res FROM mnt_m1_results ORDER BY n;
ROLLBACK;
