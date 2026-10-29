-- QR execution flow (install_v1): authenticated resolution, assignment by session, run/close/admin split,
-- idempotent execution, justified exceptions, closing rules and QR regeneration. Synthetic ids only.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages = notice;
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO PUBLIC;
CREATE FUNCTION t.login(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', CASE WHEN p IS NULL THEN '' ELSE json_build_object('sub', p)::text END, false) $$;
CREATE FUNCTION t.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS TRUE THEN RAISE NOTICE 'PASS %', label; ELSE RAISE EXCEPTION 'FAIL %', label; END IF; END $$;
CREATE FUNCTION t.fails(label text, stmt text, state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF state IS NOT NULL AND SQLSTATE <> state THEN
      RAISE EXCEPTION 'FAIL % (esperado %, obtenido %: %)', label, state, SQLSTATE, SQLERRM;
    END IF;
    RAISE NOTICE 'PASS %', label; RETURN;
  END;
  RAISE EXCEPTION 'FAIL % (no falló)', label;
END $$;
CREATE FUNCTION t.rows(stmt text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int; BEGIN EXECUTE stmt; GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

\set orgA '''a0000000-0000-4000-8000-000000000001'''
\set orgB '''b0000000-0000-4000-8000-000000000001'''
\set adminA '''a0000000-0000-4000-8000-0000000000a1'''
\set viewA '''a0000000-0000-4000-8000-0000000000a2'''
\set closeA '''a0000000-0000-4000-8000-0000000000a3'''
\set runA '''a0000000-0000-4000-8000-0000000000a4'''
\set run2A '''a0000000-0000-4000-8000-0000000000a5'''
\set adminB '''b0000000-0000-4000-8000-0000000000b1'''
\set siteA '''a0000000-0000-4000-8000-00000000051e'''
\set a1 '''a0000000-0000-4000-8000-0000000a5e01'''
\set a2 '''a0000000-0000-4000-8000-0000000a5e02'''
\set a3 '''a0000000-0000-4000-8000-0000000a5e03'''
\set plan '''a0000000-0000-4000-8000-000000009101'''

SELECT public.mnt_register_org(:orgA), public.mnt_register_org(:orgB);
INSERT INTO host_stub.members VALUES
  (:orgA, :adminA, 'Admin A', '{mnt.admin}'), (:orgA, :viewA, 'Lector A', '{mnt.view}'),
  (:orgA, :closeA, 'Supervisor A', '{mnt.view,mnt.run,mnt.close}'), (:orgA, :runA, 'Operario A', '{mnt.view,mnt.run}'),
  (:orgA, :run2A, 'Operario no asignado', '{mnt.view,mnt.run}'), (:orgB, :adminB, 'Admin B', '{mnt.admin}');
INSERT INTO host_stub.sites VALUES (:orgA, :siteA);

SET ROLE authenticated;
SELECT t.login(:adminA);
INSERT INTO mnt_org_asset_types(org_id, asset_type_id) SELECT :orgA, id FROM mnt_asset_types WHERE code = 'extinguisher_co2';
INSERT INTO mnt_assets(id, org_id, asset_type_id, site_ref, name)
  SELECT x, :orgA, t2.id, :siteA, 'Extintor' FROM mnt_asset_types t2, unnest(ARRAY[:a1, :a2, :a3]::uuid[]) x WHERE t2.code = 'extinguisher_co2';
INSERT INTO mnt_checklist_templates(id, org_id, code, name, asset_family_id)
  SELECT 'a0000000-0000-4000-8000-00000000c701', :orgA, 'CHK1', 'Revision', id FROM mnt_asset_families WHERE code = 'pci';
INSERT INTO mnt_checklist_versions(id, org_id, template_id, version) VALUES ('a0000000-0000-4000-8000-00000000c7a1', :orgA, 'a0000000-0000-4000-8000-00000000c701', 1);
INSERT INTO mnt_checklist_questions(id, org_id, version_id, position, prompt, response_type, creates_incident) VALUES
  ('a0000000-0000-4000-8000-00000000c7b1', :orgA, 'a0000000-0000-4000-8000-00000000c7a1', 1, 'Presion correcta', 'ok_ko_na', true);
SELECT public.mnt_publish_checklist_version(:orgA, 'a0000000-0000-4000-8000-00000000c7a1');
INSERT INTO mnt_plans(id, org_id, code, name, asset_family_id, frequency)
  SELECT :plan, :orgA, 'P1', 'Plan trimestral', id, 'quarterly' FROM mnt_asset_families WHERE code = 'pci';
INSERT INTO mnt_plan_assets(org_id, plan_id, asset_id) VALUES (:orgA, :plan, :a1), (:orgA, :plan, :a2);
INSERT INTO mnt_plan_type_templates(org_id, plan_id, asset_type_id, checklist_template_id)
  SELECT :orgA, :plan, id, 'a0000000-0000-4000-8000-00000000c701' FROM mnt_asset_types WHERE code = 'extinguisher_co2';
SELECT t.login(:closeA);
SELECT public.mnt_create_session(:orgA, 'a0000000-0000-4000-8000-0000000e0001', :plan, :siteA) AS s1 \gset
SELECT id AS i1 FROM mnt_session_items WHERE session_id = :'s1' AND asset_id = :a1 \gset
SELECT id AS i2 FROM mnt_session_items WHERE session_id = :'s1' AND asset_id = :a2 \gset
RESET ROLE;
SELECT qr_token AS tok1 FROM mnt_assets WHERE id = :a1 \gset
SELECT qr_token AS tok3 FROM mnt_assets WHERE id = :a3 \gset
SET ROLE authenticated;

-- 1. without session
SELECT t.login(NULL);
SELECT t.ok('qr: sin sesion no revela datos', public.mnt_resolve_scan(:'tok1') = '{"status":"not_available"}'::jsonb);
-- 2. other organization
SELECT t.login(:adminB);
SELECT t.ok('qr: otra empresa recibe respuesta generica', public.mnt_resolve_scan(:'tok1', :'s1') = '{"status":"not_available"}'::jsonb);
SELECT t.fails('qr: otra empresa no registra ejecucion', format('SELECT public.mnt_record_item_execution(%L, %L, ''ok'', NULL, ''keyB00000'')', :orgA, :'i1'), '42501');
SELECT t.ok('qr: otra empresa no modifica items', t.rows(format('UPDATE mnt_session_items SET observations = ''x'' WHERE id = %L', :'i1')) = 0);
-- 3. same company without run
SELECT t.login(:viewA);
SELECT t.ok('qr: sin permiso run rechazado', public.mnt_resolve_scan(:'tok1', :'s1') = '{"status":"not_available"}'::jsonb);
-- 4. same company with run but not assigned
SELECT t.login(:run2A);
SELECT t.ok('qr: run no asignado -> generico (con sesion)', public.mnt_resolve_scan(:'tok1', :'s1') = '{"status":"not_available"}'::jsonb);
SELECT t.ok('qr: run no asignado -> generico (sin sesion)', public.mnt_resolve_scan(:'tok1') = '{"status":"not_available"}'::jsonb);
SELECT t.ok('qr: run no asignado no ve la sesion en su lista', public.mnt_list_my_runnable_sessions(:orgA) = '[]'::jsonb);
SELECT t.fails('qr: run no asignado no registra', format('SELECT public.mnt_record_item_execution(%L, %L, ''ok'', NULL, ''keyU00000'')', :orgA, :'i1'), '42501');
SELECT t.ok('qr: run no asignado no actualiza por RLS', t.rows(format('UPDATE mnt_session_items SET observations = ''x'' WHERE id = %L', :'i1')) = 0);
SELECT t.fails('qr: run no asignado no responde checklist', format('INSERT INTO mnt_responses(org_id, item_id, question_id, answer) VALUES (%L, %L, ''a0000000-0000-4000-8000-00000000c7b1'', ''{}'')', :orgA, :'i1'), '42501');
SELECT t.fails('qr: operario no asigna operarios', format('SELECT public.mnt_assign_session_people(%L, %L, ARRAY[%L]::uuid[])', :orgA, :'s1', :run2A), '42501');
-- assignment by supervisor
SELECT t.login(:closeA);
SELECT t.ok('qr: supervisor asigna operario', public.mnt_assign_session_people(:orgA, :'s1', ARRAY[:runA]::uuid[]) = 1);
SELECT t.login(:runA);
SELECT t.ok('qr: asignado resuelve el activo de su sesion', public.mnt_resolve_scan(:'tok1', :'s1')->>'item_id' = :'i1');
SELECT t.ok('qr: sin sesion lista solo sus sesiones', jsonb_array_length(public.mnt_resolve_scan(:'tok1')->'sessions') = 1);
SELECT t.ok('qr: lista de sesiones ejecutables propia', jsonb_array_length(public.mnt_list_my_runnable_sessions(:orgA)) = 1);
-- 5. asset outside the session
SELECT t.ok('qr: activo fuera de la sesion rechazado', public.mnt_resolve_scan(:'tok3', :'s1') = '{"status":"not_available"}'::jsonb);
SELECT t.ok('qr: token inexistente generico', public.mnt_resolve_scan(repeat('f', 32), :'s1') = '{"status":"not_available"}'::jsonb);
-- 6. idempotent execution
SELECT t.ok('qr: primera ejecucion', (public.mnt_record_item_execution(:orgA, :'i1', 'ok', 'bien', 'key-0001-x')->>'replayed')::boolean = false);
SELECT t.ok('qr: reintento con la misma clave no duplica', (public.mnt_record_item_execution(:orgA, :'i1', 'ok', 'bien', 'key-0001-x')->>'replayed')::boolean = true);
RESET ROLE;
SELECT t.ok('qr: una unica ejecucion registrada', (SELECT count(*) FROM mnt_item_execution_keys WHERE item_id = :'i1') = 1
       AND (SELECT completed_by_ref FROM mnt_session_items WHERE id = :'i1') = :runA);
SET ROLE authenticated;
-- 7. run cannot close nor justify
SELECT t.fails('qr: operario sin close no cierra', format('SELECT public.mnt_close_session(%L, %L)', :orgA, :'s1'), '42501');
SELECT t.fails('qr: operario sin close no registra excepciones', format('SELECT public.mnt_record_closure_exception(%L, %L, ''inaccessible'', ''no llego'')', :orgA, :'i2'), '42501');
-- 8. close blocked with pending; exception rules
SELECT t.login(:closeA);
SELECT t.fails('qr: cierre bloqueado con pendientes', format('SELECT public.mnt_close_session(%L, %L)', :orgA, :'s1'), '23514');
SELECT t.fails('qr: excepcion exige motivo', format('SELECT public.mnt_record_closure_exception(%L, %L, ''other'', '' '')', :orgA, :'i2'), '23514');
SELECT t.fails('qr: excepcion solo sobre pendientes', format('SELECT public.mnt_record_closure_exception(%L, %L, ''other'', ''ya hecho'')', :orgA, :'i1'), '55000');
SELECT t.ok('qr: excepcion motivada registrada', (public.mnt_record_closure_exception(:orgA, :'i2', 'inaccessible', 'Sala cerrada con llave')->>'recorded_now')::boolean);
SELECT t.ok('qr: excepcion no cuenta como revisado', (SELECT result FROM mnt_session_items WHERE id = :'i2') = 'excepted');
SELECT t.login(:runA);
SELECT t.fails('qr: item exceptuado no se ejecuta', format('SELECT public.mnt_record_item_execution(%L, %L, ''ok'', NULL, ''key-0002-x'')', :orgA, :'i2'), '55000');
-- 9. close allowed with justified exception, history recorded
SELECT t.login(:closeA);
SELECT public.mnt_close_session(:orgA, :'s1');
RESET ROLE;
SELECT t.ok('qr: cierre con excepcion motivada permitido', (SELECT status || '/' || outcome FROM mnt_sessions WHERE id = :'s1') = 'closed/partial');
SELECT t.ok('qr: historial de cierre con ejecutores y excepciones', (SELECT jsonb_array_length(summary->'exceptions') = 1
         AND summary->'exceptions'->0->>'code' = 'inaccessible' AND summary->'executors'->0->>'ref' = :runA
         FROM mnt_session_closure_events WHERE session_id = :'s1'));
SELECT t.fails('qr: excepciones inmutables', format('UPDATE mnt_session_item_exceptions SET reason_text = ''x'' WHERE item_id = %L', :'i2'), '55000');
SET ROLE authenticated;
-- 10. regeneration
SELECT t.login(:runA);
SELECT t.fails('qr: regenerar exige admin', format('SELECT public.mnt_regenerate_asset_qr(%L, %L)', :orgA, :a1), '42501');
SELECT t.login(:adminA);
SELECT public.mnt_regenerate_asset_qr(:orgA, :a1) AS tok1new \gset
SELECT public.mnt_create_session(:orgA, 'a0000000-0000-4000-8000-0000000e0002', :plan, :siteA) AS s2 \gset
SELECT t.ok('qr: token antiguo invalidado', public.mnt_resolve_scan(:'tok1', :'s2') = '{"status":"not_available"}'::jsonb);
SELECT t.ok('qr: token nuevo valido', public.mnt_resolve_scan(:'tok1new', :'s2')->>'status' = 'ok');
RESET ROLE;
SELECT t.ok('qr: solo se guarda el hash del token anterior', (SELECT old_token_sha256 = encode(sha256(convert_to(:'tok1', 'UTF8')), 'hex')
         AND old_token_sha256 <> :'tok1' FROM mnt_qr_token_events WHERE asset_id = :a1)
       AND NOT EXISTS (SELECT 1 FROM mnt_qr_token_events WHERE old_token_sha256 = :'tok1'));
\echo SCAN_DONE
