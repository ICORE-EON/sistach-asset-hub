-- Real PostgreSQL behaviour tests for install_v1 (RLS, triggers, RPC, transactions).
-- Synthetic ids only; no real data or credentials. Each check prints "PASS <name>" or aborts.
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- ids (synthetic)
\set orgA '''a0000000-0000-4000-8000-000000000001'''
\set orgB '''b0000000-0000-4000-8000-000000000001'''
\set adminA '''a0000000-0000-4000-8000-0000000000a1'''
\set viewA '''a0000000-0000-4000-8000-0000000000a2'''
\set adminB '''b0000000-0000-4000-8000-0000000000b1'''
\set nobody '''c0000000-0000-4000-8000-0000000000c1'''
\set siteA '''a0000000-0000-4000-8000-00000000051e'''
\set siteB '''b0000000-0000-4000-8000-00000000051e'''

-- ---- host provisioning (as host/installer) ----
SELECT public.mnt_register_org(:orgA), public.mnt_register_org(:orgB);
INSERT INTO host_stub.members VALUES (:orgA, :adminA, 'Admin A', '{mnt.admin}'), (:orgA, :viewA, 'Lector A', '{mnt.view}'),
                                    (:orgB, :adminB, 'Admin B', '{mnt.admin}');
INSERT INTO host_stub.sites VALUES (:orgA, :siteA), (:orgB, :siteB);
INSERT INTO host_stub.doc_versions VALUES (:orgA, 'a0000000-0000-4000-8000-0000000d0c01', repeat('a', 64)),
                                         (:orgB, 'b0000000-0000-4000-8000-0000000d0c01', repeat('b', 64));
SELECT t.ok('catalogo: 5 familias y 14 tipos globales', (SELECT count(*) FROM mnt_asset_families WHERE org_id IS NULL) = 5
       AND (SELECT count(*) FROM mnt_asset_types WHERE org_id IS NULL) = 14);
SELECT t.ok('catalogo: ningun tipo activado automaticamente', (SELECT count(*) FROM mnt_org_asset_types) = 0);

-- ---- org A setup as admin A (through RLS) ----
SET ROLE authenticated;
SELECT t.login(:adminA);
SELECT t.fails('tipo no activado: no se puede crear el activo',
  format('INSERT INTO mnt_assets(org_id, asset_type_id, code) SELECT %L, id, ''X'' FROM mnt_asset_types WHERE code=''extinguisher_co2''', :orgA), '23503');
INSERT INTO mnt_org_asset_types(org_id, asset_type_id) SELECT :orgA, id FROM mnt_asset_types WHERE code = 'extinguisher_co2';
INSERT INTO mnt_assets(id, org_id, asset_type_id, site_ref, name)
  SELECT 'a0000000-0000-4000-8000-0000000a5e01', :orgA, id, :siteA, 'Extintor A1' FROM mnt_asset_types WHERE code = 'extinguisher_co2';
INSERT INTO mnt_assets(id, org_id, asset_type_id, site_ref, name)
  SELECT 'a0000000-0000-4000-8000-0000000a5e02', :orgA, id, :siteA, 'Extintor A2' FROM mnt_asset_types WHERE code = 'extinguisher_co2';
SELECT t.ok('codigo automatico por organizacion', (SELECT code FROM mnt_assets WHERE id='a0000000-0000-4000-8000-0000000a5e01') LIKE 'AST-%-0001');
INSERT INTO mnt_checklist_templates(id, org_id, code, name, asset_family_id)
  SELECT 'a0000000-0000-4000-8000-00000000c701', :orgA, 'CHK1', 'Revision extintor', id FROM mnt_asset_families WHERE code = 'pci';
INSERT INTO mnt_checklist_versions(id, org_id, template_id, version) VALUES ('a0000000-0000-4000-8000-00000000c7a1', :orgA, 'a0000000-0000-4000-8000-00000000c701', 1);
INSERT INTO mnt_checklist_questions(id, org_id, version_id, position, prompt, response_type, creates_incident) VALUES
  ('a0000000-0000-4000-8000-00000000c7b1', :orgA, 'a0000000-0000-4000-8000-00000000c7a1', 1, 'Presion correcta', 'ok_ko_na', true),
  ('a0000000-0000-4000-8000-00000000c7b2', :orgA, 'a0000000-0000-4000-8000-00000000c7a1', 2, 'Precinto', 'ok_ko_na', false);
SELECT public.mnt_publish_checklist_version(:orgA, 'a0000000-0000-4000-8000-00000000c7a1');
INSERT INTO mnt_certificate_templates(id, org_id, code, name, title) VALUES ('a0000000-0000-4000-8000-00000000ce01', :orgA, 'CT1', 'Plantilla', 'Certificado PCI');
INSERT INTO mnt_plans(id, org_id, code, name, asset_family_id, frequency, certificate_template_id)
  SELECT 'a0000000-0000-4000-8000-000000009101', :orgA, 'P1', 'Plan trimestral', id, 'quarterly', 'a0000000-0000-4000-8000-00000000ce01'
    FROM mnt_asset_families WHERE code = 'pci';
INSERT INTO mnt_plan_assets(org_id, plan_id, asset_id) VALUES
  (:orgA, 'a0000000-0000-4000-8000-000000009101', 'a0000000-0000-4000-8000-0000000a5e01'),
  (:orgA, 'a0000000-0000-4000-8000-000000009101', 'a0000000-0000-4000-8000-0000000a5e02');
INSERT INTO mnt_plan_type_templates(org_id, plan_id, asset_type_id, checklist_template_id)
  SELECT :orgA, 'a0000000-0000-4000-8000-000000009101', id, 'a0000000-0000-4000-8000-00000000c701' FROM mnt_asset_types WHERE code = 'extinguisher_co2';

-- ---- org B setup as admin B ----
SELECT t.login(:adminB);
INSERT INTO mnt_org_asset_types(org_id, asset_type_id) SELECT :orgB, id FROM mnt_asset_types WHERE code = 'extinguisher_co2';
INSERT INTO mnt_assets(id, org_id, asset_type_id, site_ref, name)
  SELECT 'b0000000-0000-4000-8000-0000000a5e01', :orgB, id, :siteB, 'Extintor B1' FROM mnt_asset_types WHERE code = 'extinguisher_co2';
SELECT t.ok('codigos independientes por organizacion', (SELECT code FROM mnt_assets WHERE id='b0000000-0000-4000-8000-0000000a5e01') LIKE 'AST-%-0001');

-- ---- isolation between organisations ----
SELECT t.ok('aislamiento: B no ve activos, planes ni plantillas de A',
  (SELECT count(*) FROM mnt_assets WHERE org_id = :orgA) = 0 AND (SELECT count(*) FROM mnt_plans) = 0
  AND (SELECT count(*) FROM mnt_checklist_questions) = 0 AND (SELECT count(*) FROM mnt_org_asset_types WHERE org_id = :orgA) = 0);
SELECT t.fails('aislamiento: B no inserta en A',
  format('INSERT INTO mnt_assets(org_id, asset_type_id, code) SELECT %L, id, ''Z'' FROM mnt_asset_types WHERE code=''extinguisher_co2''', :orgA), '42501');
SELECT t.fails('aislamiento: B no modifica activos de A (0 filas -> sin efecto)',
  format('DO $$ BEGIN UPDATE mnt_assets SET name = ''x'' WHERE org_id = %L; IF FOUND THEN RAISE EXCEPTION ''updated''; END IF; RAISE EXCEPTION USING ERRCODE = ''42501''; END $$', :orgA), '42501');
SELECT t.fails('cruce: equipo de botiquin de B apuntando a activo de A (FK compuesta)',
  format('INSERT INTO mnt_kit_items(org_id, asset_id, product_name) VALUES (%L, ''a0000000-0000-4000-8000-0000000a5e01'', ''Gasas'')', :orgB), '23503');
SELECT t.fails('cruce: activo de B en centro de A',
  format('INSERT INTO mnt_assets(org_id, asset_type_id, site_ref) SELECT %L, id, %L FROM mnt_asset_types WHERE code=''extinguisher_co2''', :orgB, :siteA), '23503');
SELECT t.fails('aislamiento: B no ejecuta RPC sobre A',
  format('SELECT public.mnt_create_session(%L, gen_random_uuid(), ''a0000000-0000-4000-8000-000000009101'')', :orgA), '42501');
SELECT t.login(:adminA);
SELECT t.fails('cruce: plan de A con activo de B (FK compuesta)',
  format('INSERT INTO mnt_plan_assets(org_id, plan_id, asset_id) VALUES (%L, ''a0000000-0000-4000-8000-000000009101'', ''b0000000-0000-4000-8000-0000000a5e01'')', :orgA), '23503');
SELECT t.fails('cruce: fila con org_id de B apuntando a plan de A',
  format('INSERT INTO mnt_plan_sites(org_id, plan_id, site_ref) VALUES (%L, ''a0000000-0000-4000-8000-000000009101'', %L)', :orgB, :siteB), '42501');

-- ---- user without organisation ----
SELECT t.login(:nobody);
SELECT t.ok('sin organizacion: no ve datos de ninguna organizacion',
  (SELECT count(*) FROM mnt_assets) = 0 AND (SELECT count(*) FROM mnt_sessions) = 0 AND (SELECT count(*) FROM mnt_org_asset_types) = 0);
SELECT t.ok('sin organizacion: el catalogo global si es visible', (SELECT count(*) FROM mnt_asset_types) = 14);
SELECT t.fails('sin organizacion: no inserta',
  format('INSERT INTO mnt_assets(org_id, asset_type_id) SELECT %L, id FROM mnt_asset_types WHERE code=''extinguisher_co2''', :orgA), '42501');
SELECT t.fails('sin organizacion: no ejecuta RPC', format('SELECT public.mnt_open_incident(%L, ''x'')', :orgA), '42501');
SELECT t.fails('usuarios: no se modifica el catalogo global',
  'DO $$ BEGIN UPDATE mnt_asset_types SET active = false WHERE org_id IS NULL; IF FOUND THEN RAISE EXCEPTION ''updated''; END IF; RAISE EXCEPTION USING ERRCODE = ''42501''; END $$', '42501');
SELECT t.login(NULL);
SELECT t.ok('sin sesion: nada visible salvo catalogo', (SELECT count(*) FROM mnt_assets) = 0);
RESET ROLE;

-- ---- anonymous ----
SET ROLE anon;
SELECT t.fails('anonimo: sin acceso a tablas', 'SELECT count(*) FROM mnt_assets', '42501');
SELECT t.fails('anonimo: sin acceso al catalogo', 'SELECT count(*) FROM mnt_asset_types', '42501');
SELECT t.fails('anonimo: sin acceso a RPC', format('SELECT public.mnt_close_session(%L, gen_random_uuid())', :orgA), '42501');
SELECT t.fails('anonimo: sin acceso a mnt_can', format('SELECT public.mnt_can(%L, ''mnt.view'')', :orgA), '42501');
RESET ROLE;

-- ---- insufficient permissions (viewer) ----
SET ROLE authenticated;
SELECT t.login(:viewA);
SELECT t.ok('lector: ve los datos de su organizacion', (SELECT count(*) FROM mnt_assets) = 2);
SELECT t.fails('lector: no crea activos',
  format('INSERT INTO mnt_assets(org_id, asset_type_id) SELECT %L, id FROM mnt_asset_types WHERE code=''extinguisher_co2''', :orgA), '42501');
SELECT t.fails('lector: no crea sesiones',
  format('SELECT public.mnt_create_session(%L, gen_random_uuid(), ''a0000000-0000-4000-8000-000000009101'')', :orgA), '42501');
SELECT t.fails('lector: no activa tipos',
  format('INSERT INTO mnt_org_asset_types(org_id, asset_type_id) SELECT %L, id FROM mnt_asset_types WHERE code=''bie_25''', :orgA), '42501');

-- ---- sessions, duplicates, atomic close ----
SELECT t.login(:adminA);
SELECT public.mnt_create_session(:orgA, 'a0000000-0000-4000-8000-0000000e0001', 'a0000000-0000-4000-8000-000000009101', :siteA) AS s1 \gset
SELECT t.ok('crear sesion es idempotente por request_id',
  public.mnt_create_session(:orgA, 'a0000000-0000-4000-8000-0000000e0001', 'a0000000-0000-4000-8000-000000009101', :siteA) = :'s1'
  AND (SELECT count(*) FROM mnt_sessions WHERE request_id = 'a0000000-0000-4000-8000-0000000e0001') = 1);
SELECT t.ok('la sesion incluye un equipo por activo del plan', (SELECT count(*) FROM mnt_session_items WHERE session_id = :'s1') = 2);
SELECT t.fails('las sesiones no se insertan directamente',
  format('INSERT INTO mnt_sessions(org_id, request_id, plan_id, code) VALUES (%L, gen_random_uuid(), ''a0000000-0000-4000-8000-000000009101'', ''X'')', :orgA), '42501');
SELECT t.fails('no se cierra con equipos pendientes', format('SELECT public.mnt_close_session(%L, %L)', :orgA, :'s1'), '23514');
INSERT INTO mnt_responses(org_id, item_id, question_id, answer, is_fail)
  SELECT :orgA, i.id, 'a0000000-0000-4000-8000-00000000c7b1', '"ko"', i.asset_id = 'a0000000-0000-4000-8000-0000000a5e01'
    FROM mnt_session_items i WHERE i.session_id = :'s1';
SELECT t.fails('duplicado: una respuesta por pregunta y equipo',
  format('INSERT INTO mnt_responses(org_id, item_id, question_id) SELECT %L, id, ''a0000000-0000-4000-8000-00000000c7b1'' FROM mnt_session_items WHERE session_id = %L LIMIT 1', :orgA, :'s1'), '23505');
UPDATE mnt_session_items SET result = CASE WHEN asset_id = 'a0000000-0000-4000-8000-0000000a5e01' THEN 'failed' ELSE 'ok' END WHERE session_id = :'s1';
SELECT t.fails('estado de sesion no editable directamente',
  format('UPDATE mnt_sessions SET status = ''closed'' WHERE id = %L', :'s1'), '42501');
SELECT (public.mnt_close_session(:orgA, :'s1'))->>'outcome' AS outcome1 \gset
SELECT t.ok('cierre atomico: estado, historial, incidencia, certificado y eventos',
  :'outcome1' = 'with_incidents'
  AND (SELECT status FROM mnt_sessions WHERE id = :'s1') = 'closed'
  AND (SELECT count(*) FROM mnt_session_history WHERE session_id = :'s1' AND event = 'closed') = 1
  AND (SELECT count(*) FROM mnt_incidents WHERE source = 'checklist') = 1
  AND (SELECT count(*) FROM mnt_incident_history) = 1
  AND (SELECT count(*) FROM mnt_certificates WHERE session_id = :'s1') = 1
  AND (SELECT count(*) FROM mnt_certificate_items ci JOIN mnt_certificates c ON c.id = ci.certificate_id WHERE c.session_id = :'s1') = 2);
SELECT t.ok('snapshot historico del actor en el cierre', (SELECT closed_by_snapshot->>'name' FROM mnt_sessions WHERE id = :'s1') = 'Admin A'
  AND (SELECT issuer_snapshot->>'name' FROM mnt_certificates WHERE session_id = :'s1') = 'Admin A');
SELECT t.fails('duplicado: segundo cierre rechazado', format('SELECT public.mnt_close_session(%L, %L)', :orgA, :'s1'), '55000');
SELECT public.mnt_reopen_session(:orgA, :'s1', 'Revisar presion');
UPDATE mnt_session_items SET observations = 'revisado' WHERE session_id = :'s1';
SELECT public.mnt_close_session(:orgA, :'s1');
SELECT t.ok('reabrir y cerrar no duplica certificado ni incidencias',
  (SELECT count(*) FROM mnt_certificates WHERE session_id = :'s1') = 1 AND (SELECT count(*) FROM mnt_incidents) = 1
  AND (SELECT count(*) FROM mnt_session_history WHERE session_id = :'s1') = 3);

-- ---- incidents ----
SELECT id AS inc1 FROM mnt_incidents LIMIT 1 \gset
SELECT t.fails('incidencia: estado no editable directamente', format('UPDATE mnt_incidents SET status = ''closed'' WHERE id = %L', :'inc1'), '42501');
SELECT t.fails('incidencia: transicion no permitida', format('SELECT public.mnt_change_incident_status(%L, %L, ''open'', ''closed'')', :orgA, :'inc1'), '55000');
SELECT t.fails('incidencia: estado de partida obsoleto', format('SELECT public.mnt_change_incident_status(%L, %L, ''resolved'', ''closed'')', :orgA, :'inc1'), '40001');
SELECT public.mnt_change_incident_status(:orgA, :'inc1', 'open', 'resolved', 'Recargado');
SELECT t.ok('incidencia: historial y evento en la misma operacion',
  (SELECT count(*) FROM mnt_incident_history WHERE incident_id = :'inc1') = 2 AND (SELECT resolved_at IS NOT NULL FROM mnt_incidents WHERE id = :'inc1'));

-- ---- certificates ----
SELECT id AS cert1 FROM mnt_certificates WHERE session_id = :'s1' \gset
SELECT t.fails('certificado: hash que no coincide con el documento', format('SELECT public.mnt_attach_certificate_pdf(%L, %L, ''a0000000-0000-4000-8000-0000000d0c01'', %L)', :orgA, :'cert1', repeat('c', 64)), '23514');
SELECT t.fails('certificado: documento de otra organizacion', format('SELECT public.mnt_attach_certificate_pdf(%L, %L, ''b0000000-0000-4000-8000-0000000d0c01'', %L)', :orgA, :'cert1', repeat('b', 64)), '23514');
SELECT public.mnt_attach_certificate_pdf(:orgA, :'cert1', 'a0000000-0000-4000-8000-0000000d0c01', repeat('a', 64));
SELECT t.fails('certificado: el PDF emitido no se sustituye', format('SELECT public.mnt_attach_certificate_pdf(%L, %L, ''a0000000-0000-4000-8000-0000000d0c01'', %L)', :orgA, :'cert1', repeat('a', 64)), '55000');
SELECT t.fails('certificado: los clientes no escriben certificados', format('UPDATE mnt_certificates SET notes = ''x'' WHERE id = %L', :'cert1'), '42501');
RESET ROLE;

-- ---- historical immutability (applies to every role, including the owner) ----
SELECT t.fails('inmutable: historial de sesion (update)', 'UPDATE mnt_session_history SET reason = ''x''', '55000');
SELECT t.fails('inmutable: historial de sesion (delete)', 'DELETE FROM mnt_session_history', '55000');
SELECT t.fails('inmutable: historial de incidencias', 'UPDATE mnt_incident_history SET note = ''x''', '55000');
SELECT t.fails('inmutable: snapshot del certificado', format('UPDATE mnt_certificates SET snapshot = ''{}'' WHERE id = %L', :'cert1'), '55000');
SELECT t.fails('inmutable: certificado no se borra', format('DELETE FROM mnt_certificates WHERE id = %L', :'cert1'), '55000');
SELECT t.fails('inmutable: items del certificado', 'UPDATE mnt_certificate_items SET result = ''ok''', '55000');
SELECT t.fails('inmutable: pregunta de version publicada', 'UPDATE mnt_checklist_questions SET prompt = ''x''', '55000');
SELECT t.fails('inmutable: version publicada', 'UPDATE mnt_checklist_versions SET notes = ''x''', '55000');
SET ROLE authenticated;
SELECT t.login(:adminA);
SELECT t.fails('inmutable: respuestas de sesion cerrada', 'UPDATE mnt_responses SET observations = ''x''', '55000');
SELECT t.fails('inmutable: equipos de sesion cerrada', 'UPDATE mnt_session_items SET observations = ''x''', '55000');
SELECT public.mnt_revoke_certificate(:orgA, :'cert1', 'Emitido por error');
SELECT t.fails('certificado: revocado no vuelve a emitido', format('SELECT public.mnt_revoke_certificate(%L, %L, ''x'')', :orgA, :'cert1'), '55000');
RESET ROLE;

-- ---- atomic rollback: a failure after writes leaves nothing behind ----
CREATE FUNCTION t.boom() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF current_setting('t.fail', true) = 'on' THEN RAISE EXCEPTION 'fallo inyectado'; END IF; RETURN NEW; END $$;
CREATE TRIGGER t_boom BEFORE INSERT ON mnt_certificates FOR EACH ROW EXECUTE FUNCTION t.boom();
SET ROLE authenticated;
SELECT t.login(:adminA);
SELECT public.mnt_create_session(:orgA, 'a0000000-0000-4000-8000-0000000e0002', 'a0000000-0000-4000-8000-000000009101', :siteA) AS s2 \gset
INSERT INTO mnt_responses(org_id, item_id, question_id, answer, is_fail)
  SELECT :orgA, id, 'a0000000-0000-4000-8000-00000000c7b1', '"ko"', true FROM mnt_session_items WHERE session_id = :'s2';
UPDATE mnt_session_items SET result = 'failed' WHERE session_id = :'s2';
RESET ROLE;
SELECT count(*) AS out_before FROM mnt_outbox \gset
SET ROLE authenticated;
SELECT set_config('t.fail', 'on', false);
SELECT t.fails('rollback: el cierre falla al emitir el certificado', format('SELECT public.mnt_close_session(%L, %L)', :orgA, :'s2'), 'P0001');
SELECT set_config('t.fail', 'off', false);
RESET ROLE;
SELECT t.ok('rollback: sesion, historial, incidencias y eventos intactos',
  (SELECT status FROM mnt_sessions WHERE id = :'s2') = 'in_progress'
  AND (SELECT count(*) FROM mnt_session_history WHERE session_id = :'s2') = 0
  AND (SELECT count(*) FROM mnt_incidents i JOIN mnt_responses r ON r.id = i.source_response_id JOIN mnt_session_items it ON it.id = r.item_id WHERE it.session_id = :'s2') = 0
  AND (SELECT count(*) FROM mnt_outbox) = :out_before);
DROP TRIGGER t_boom ON mnt_certificates;

-- ---- outbox consumption by the host ----
SET ROLE service_role;
SELECT t.ok('outbox: eventos disponibles para el host', (SELECT count(*) FROM mnt_outbox WHERE org_id = :orgA AND event_type = 'session.closed') = 2);
UPDATE mnt_outbox SET processed_at = now() WHERE event_type = 'session.closed';
SELECT t.fails('outbox: el host no altera el contenido de eventos', 'UPDATE mnt_outbox SET payload = ''{}''', '42501');
RESET ROLE;
SET ROLE authenticated;
SELECT t.login(:adminA);
SELECT t.fails('outbox: los usuarios no leen eventos', 'SELECT count(*) FROM mnt_outbox', '42501');
RESET ROLE;
\echo TESTS_DONE
