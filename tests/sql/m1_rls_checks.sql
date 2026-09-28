-- Pruebas RLS/estructura de M1. Todo termina en ROLLBACK: no deja datos.
BEGIN;
INSERT INTO public.asset_types(id, company_id, code, name_i18n, category) VALUES ('00000000-0000-4000-8000-00000000c7b1', 'f80df1ea-1d54-43f1-9330-e35d277c91a6', 'M1TEST', '{}', 'other');
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_types VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r1', json_build_object('actor','admin A','test','insert tipo en plantilla A','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r2', json_build_object('actor','admin A','test','insert centro en plantilla A','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r3', json_build_object('actor','admin A','test','insert centro en plan A','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r4', json_build_object('actor','admin A','test','habilitar tipo global en A','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_plan_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r5', json_build_object('actor','admin A','test','leer puentes de A','expected','rows:4','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=false WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r6', json_build_object('actor','admin A','test','deshabilitar tipo global','expected','rows:1','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET asset_type_id='00000000-0000-4000-8000-00000000c7b1' WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r7', json_build_object('actor','admin A','test','cambiar tipo de la habilitación','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','00000000-0000-4000-8000-00000000c7b1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r8', json_build_object('actor','admin A','test','habilitar tipo de otra empresa','expected','rej:23503','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_types VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','00000000-0000-4000-8000-00000000c7b1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r9', json_build_object('actor','admin A','test','tipo de otra empresa en plantilla A','expected','rej:23503','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r10', json_build_object('actor','admin A','test','plantilla A con centro de B','expected','rej:23503','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_plan_sites WHERE plan_id='51d28637-6c89-40a9-9602-69bc0343e852'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r11', json_build_object('actor','admin A','test','borrar su propio centro de plan','expected','rows:1','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' UNION ALL SELECT 1 FROM public.mnt_org_asset_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d') q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r12', json_build_object('actor','admin B','test','leer puentes de A','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r13', json_build_object('actor','admin B','test','insert con org_id de A','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','65203ff4-a756-40a4-a018-6c24b1f54152','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r14', json_build_object('actor','admin B','test','insert en B apuntando a plantilla de A','expected','rej:23503','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','51d28637-6c89-40a9-9602-69bc0343e852','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r15', json_build_object('actor','admin B','test','insert en B apuntando a plan de A','expected','rej:23503','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r16', json_build_object('actor','admin B','test','mover fila propia a A (org_id)','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r17', json_build_object('actor','admin B','test','borrar puentes de A','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r18', json_build_object('actor','admin B','test','actualizar habilitación de A','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fbf169ac-47e9-4061-a3b2-c9e030e1f214","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('f80df1ea-1d54-43f1-9330-e35d277c91a6','8dadaa50-3117-40e4-b7d1-7aafe7c0521e','e676ae41-2a82-422c-88a8-18d87805f0f1'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r19', json_build_object('actor','admin B','test','insert válido en B','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_org_asset_types UNION ALL SELECT 1 FROM public.mnt_plan_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r20', json_build_object('actor','sin empresa','test','leer puentes','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_checklist_template_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','65203ff4-a756-40a4-a018-6c24b1f54152','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r21', json_build_object('actor','sin empresa','test','insert en A','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bacbcc08-a48e-4138-915d-6fa76c4c38bb","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_org_asset_types(org_id, asset_type_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','6d37ba20-ea6f-4582-bdb8-0b115fad874a'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r22', json_build_object('actor','sin empresa','test','habilitar tipo en A','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r23', json_build_object('actor','anon','test','leer mnt_checklist_template_types','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r24', json_build_object('actor','anon','test','leer mnt_checklist_template_sites','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_plan_sites) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r25', json_build_object('actor','anon','test','leer mnt_plan_sites','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r26', json_build_object('actor','anon','test','leer mnt_org_asset_types','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_outbox) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r27', json_build_object('actor','anon','test','leer mnt_outbox','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_migration_runs) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r28', json_build_object('actor','anon','test','leer mnt_migration_runs','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_outbox) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r29', json_build_object('actor','admin A','test','leer mnt_outbox','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_outbox(org_id,event_type,aggregate_type,aggregate_id) VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','x','x','e5b35c19-afd3-4675-9654-070e8a8ffc7d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r30', json_build_object('actor','admin A','test','escribir mnt_outbox','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_migration_runs) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r31', json_build_object('actor','admin A','test','leer mnt_migration_runs','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_org_asset_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r32', json_build_object('actor','admin A','test','borrar habilitación (sin política)','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_checklist_template_types SET org_id=org_id; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r33', json_build_object('actor','admin A','test','actualizar puente inmutable','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
UPDATE public.company_members SET role='employee' WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443';
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN SELECT count(*) INTO c FROM (SELECT 1 FROM public.mnt_checklist_template_types UNION ALL SELECT 1 FROM public.mnt_checklist_template_sites UNION ALL SELECT 1 FROM public.mnt_org_asset_types) q; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r34', json_build_object('actor','empleado A','test','leer puentes de A','expected','rows:3','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r35', json_build_object('actor','empleado A','test','insert centro en plan A','expected','rej:42501','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_types WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r36', json_build_object('actor','empleado A','test','borrar tipo de plantilla A','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r37', json_build_object('actor','empleado A','test','actualizar habilitación','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
UPDATE public.company_members SET role='system_manager' WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443';
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN INSERT INTO public.mnt_plan_sites VALUES ('e5b35c19-afd3-4675-9654-070e8a8ffc7d','51d28637-6c89-40a9-9602-69bc0343e852','be3b894e-1bd1-4b44-940c-ded3ee4909e8'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r38', json_build_object('actor','responsable sistema A','test','insert centro en plan A','expected','ok','got',v)::text, true);
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"3b7de027-5b93-4336-a2a3-ececd12f7443","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v text; c bigint; BEGIN
  BEGIN UPDATE public.mnt_org_asset_types SET enabled=true WHERE org_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:'||c; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r39', json_build_object('actor','responsable sistema A','test','habilitar tipo (solo administrador)','expected','rows:0','got',v)::text, true);
END $t$;
RESET ROLE;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_items SET company_id='f80df1ea-1d54-43f1-9330-e35d277c91a6' WHERE id=('785b092d-7fff-4272-87de-ae7415464f9d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r40', json_build_object('actor','propietario','test','ítem con company_id de B y sesión de A','expected','rej:23503','got',v)::text, true);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_items SET company_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d' WHERE id=('785b092d-7fff-4272-87de-ae7415464f9d'); v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r41', json_build_object('actor','propietario','test','ítem con company_id de A (correcto)','expected','ok','got',v)::text, true);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN INSERT INTO public.maintenance_items(session_id, asset_id, checklist_template_version_id, result) SELECT session_id, asset_id, checklist_template_version_id, result FROM public.maintenance_items WHERE id='785b092d-7fff-4272-87de-ae7415464f9d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r42', json_build_object('actor','propietario','test','ítem nuevo sin company_id (app actual)','expected','ok','got',v)::text, true);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.maintenance_plans SET checklist_template_id='4f76f59e-8dba-462b-892c-b918aa73bfb6' WHERE id='51d28637-6c89-40a9-9602-69bc0343e852'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r43', json_build_object('actor','propietario','test','plan de A con plantilla de B','expected','rej:23503','got',v)::text, true);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN UPDATE public.assets SET location_id='e676ae41-2a82-422c-88a8-18d87805f0f1' WHERE company_id='e5b35c19-afd3-4675-9654-070e8a8ffc7d'; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r44', json_build_object('actor','propietario','test','activo de A en centro de B','expected','rej:23503','got',v)::text, true);
END $t$;
DO $t$ DECLARE v text; BEGIN
  BEGIN DELETE FROM public.mnt_checklist_template_sites; DELETE FROM public.mnt_plan_sites; DELETE FROM public.locations WHERE id='be3b894e-1bd1-4b44-940c-ded3ee4909e8'; IF EXISTS (SELECT 1 FROM public.assets WHERE company_id IS NULL) THEN RAISE EXCEPTION 'company_id anulado'; END IF; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := 'rej:'||SQLSTATE; END;
  PERFORM set_config('mnt_t.r45', json_build_object('actor','propietario','test','borrar centro de A anula solo location_id','expected','ok','got',v)::text, true);
END $t$;
SELECT i AS n, r->>'actor' AS actor, r->>'test' AS test, r->>'expected' AS expected, r->>'got' AS got, CASE WHEN r->>'expected' = r->>'got' THEN 'PASA' ELSE 'FALLA' END AS res FROM generate_series(1,45) i, LATERAL (SELECT current_setting('mnt_t.r'||i)::json AS r) x ORDER BY i;
ROLLBACK;
