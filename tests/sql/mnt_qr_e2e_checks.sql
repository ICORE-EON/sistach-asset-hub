-- QR operativo — recorrido funcional completo con datos sintéticos (Asset Guardian).
-- Todo ocurre en UNA transacción que SIEMPRE se revierte (RAISE EXCEPTION final): empresas, activos, plan,
-- checklist, sesiones, asignaciones, ejecuciones, excepción, cierre y certificado son ficticios y no quedan.
-- Actores: tres cuentas existentes usadas solo como identidades dentro de las empresas sintéticas.
--   SUP = manager (mnt.run + mnt.close), OPA = employee asignado (solo mnt.run), OPB = employee NO asignado;
--   al final OPB deja la empresa A y es administrador de la empresa sintética B.
DO $run$
DECLARE
  SUP constant uuid := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  OPA constant uuid := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  OPB constant uuid := 'bacbcc08-a48e-4138-915d-6fa76c4c38bb';
  CA constant uuid := '00000000-0000-4000-8000-0000000e2e01';
  CB constant uuid := '00000000-0000-4000-8000-0000000e2e02';
  A1 constant uuid := '00000000-0000-4000-8000-0000000e2a01';
  A2 constant uuid := '00000000-0000-4000-8000-0000000e2a02';
  S1 constant uuid := '00000000-0000-4000-8000-0000000e2501';
  S2 constant uuid := '00000000-0000-4000-8000-0000000e2502';
  I1 constant uuid := '00000000-0000-4000-8000-0000000e2101';
  I2 constant uuid := '00000000-0000-4000-8000-0000000e2102';
  V1 constant uuid := '00000000-0000-4000-8000-0000000e2c01';
  Q1 constant uuid := '00000000-0000-4000-8000-0000000e2d01';
  CERT constant uuid := '00000000-0000-4000-8000-0000000e2f01';
  TOK1 constant text := 'e2e0000000000000000000000000000000000001';
  T uuid; F uuid; P uuid; TPL uuid;
  total int := 0; passed int := 0; fails text := ''; results text := '';
  j jsonb; n bigint; ok boolean; summary jsonb;
BEGIN
  -- ---------- fixture (propietario, sin RLS) ----------
  INSERT INTO public.companies(id, name, cif) VALUES (CA, 'E2E QR Empresa A (sintética)', 'E2EQRA'), (CB, 'E2E QR Empresa B (sintética)', 'E2EQRB');
  INSERT INTO public.company_members(company_id, user_id, role, active) VALUES
    (CA, SUP, 'manager', true), (CA, OPA, 'employee', true), (CA, OPB, 'employee', true), (CB, OPB, 'administrator', true);
  INSERT INTO public.asset_families(company_id, code, name_i18n) VALUES (CA, 'E2E-F', '{"es":"Extintores E2E"}') RETURNING id INTO F;
  INSERT INTO public.asset_types(company_id, family_id, code, category, name_i18n) VALUES (CA, F, 'E2E-T', 'fire', '{"es":"Extintor E2E"}') RETURNING id INTO T;
  INSERT INTO public.assets(id, company_id, asset_type_id, code, name, status, qr_token) VALUES
    (A1, CA, T, 'E2E-001', 'Extintor pasillo', 'active', TOK1),
    (A2, CA, T, 'E2E-002', 'Extintor sala técnica', 'active', 'e2e0000000000000000000000000000000000002');
  INSERT INTO public.maintenance_plans(company_id, code, name, frequency, asset_family_id, execution_mode)
    VALUES (CA, 'E2E-P', 'Revisión trimestral E2E', 'quarterly', F, 'internal') RETURNING id INTO P;
  INSERT INTO public.checklist_templates(company_id, code, name) VALUES (CA, 'E2E-CL', 'Checklist E2E') RETURNING id INTO TPL;
  INSERT INTO public.checklist_template_versions(id, company_id, template_id, version, is_published) VALUES (V1, CA, TPL, 1, true);
  INSERT INTO public.checklist_questions(id, template_version_id, position, prompt, response_type) VALUES (Q1, V1, 1, '¿Presión correcta?', 'boolean');
  INSERT INTO public.maintenance_sessions(id, company_id, code, plan_id, status, started_at, kind, created_by) VALUES
    (S1, CA, 'E2E-S1', P, 'in_progress', now(), 'preventive', SUP),
    (S2, CA, 'E2E-S2', P, 'in_progress', now(), 'preventive', SUP);
  INSERT INTO public.maintenance_items(id, company_id, session_id, asset_id, result, checklist_template_version_id, metadata) VALUES
    (I1, CA, S1, A1, 'pending', V1, '{"snapshot":{"asset":{"code":"E2E-001","name":"Extintor pasillo"}}}'),
    (I2, CA, S1, A2, 'pending', V1, '{"snapshot":{"asset":{"code":"E2E-002","name":"Extintor sala técnica"}}}');
  INSERT INTO public.maintenance_items(company_id, session_id, asset_id, result, checklist_template_version_id) VALUES (CA, S2, A1, 'pending', V1);

  CREATE TEMP TABLE e2e(n int, name text, expected text, actual text) ON COMMIT DROP;
  CREATE FUNCTION pg_temp.act(u uuid) RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    SET LOCAL ROLE authenticated; END $f$;
  CREATE FUNCTION pg_temp.q(sql text) RETURNS text LANGUAGE plpgsql AS $f$ DECLARE v text; BEGIN
    BEGIN EXECUTE sql INTO v; RETURN coalesce(v, 'null');
    EXCEPTION WHEN OTHERS THEN RETURN 'rej:' || SQLSTATE; END; END $f$;
  CREATE FUNCTION pg_temp.c(nm text, ex text, sq text) RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
    INSERT INTO e2e SELECT coalesce(max(n), 0) + 1, nm, ex, pg_temp.q(sq) FROM e2e; END $f$;

  -- 1. supervisor asigna al operario A
  PERFORM pg_temp.act(SUP);
  PERFORM pg_temp.c('supervisor asigna operario A a S1', '1', format($$SELECT public.mnt_sa_assign_session_people(%L, %L, ARRAY[%L]::uuid[])$$, CA, S1, OPA));
  PERFORM pg_temp.c('supervisor ve las 2 sesiones de la empresa', '2', format($$SELECT count(*) FROM public.maintenance_sessions WHERE company_id = %L$$, CA));
  -- 2. operario A ve solo su sesión en TODAS las lecturas
  PERFORM pg_temp.act(OPA);
  PERFORM pg_temp.c('operario A: tabla de sesiones solo la asignada', 'E2E-S1', format($$SELECT string_agg(code, ',') FROM public.maintenance_sessions WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('operario A: equipos solo de su sesión', '2', format($$SELECT count(*) FROM public.maintenance_items WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('operario A: lista móvil solo su sesión', '1', format($$SELECT jsonb_array_length(public.mnt_sa_list_my_runnable_sessions(%L))$$, CA));
  PERFORM pg_temp.c('operario A: personas de S2 no visibles', '[]', format($$SELECT public.mnt_sa_list_session_people(%L, %L)::text$$, CA, S2));
  -- 3. escanea / resuelve
  PERFORM pg_temp.c('operario A: QR sin sesión ofrece solo S1', '1', format($$SELECT jsonb_array_length(public.mnt_sa_resolve_scan(%L)->'sessions')$$, TOK1));
  PERFORM pg_temp.c('operario A: QR con S1 resuelve su equipo', I1::text, format($$SELECT public.mnt_sa_resolve_scan(%L, %L)->>'item_id'$$, TOK1, S1));
  PERFORM pg_temp.c('operario A: QR con S2 no asignada -> genérico', 'not_available', format($$SELECT public.mnt_sa_resolve_scan(%L, %L)->>'status'$$, TOK1, S2));
  -- 4. cumplimenta checklist y guarda
  PERFORM pg_temp.c('operario A guarda respuesta de checklist', '1', format($$WITH x AS (INSERT INTO public.checklist_responses(company_id, maintenance_item_id, checklist_template_version_id, question_id, answer, is_fail, answered_by) VALUES (%L, %L, %L, %L, 'true', false, %L) RETURNING 1) SELECT count(*) FROM x$$, CA, I1, V1, Q1, OPA));
  PERFORM pg_temp.c('operario A registra ejecución', 'false', format($$SELECT public.mnt_sa_record_item_execution(%L, %L, %L, 'ok', 'Presión correcta', 0, 'e2e-key-0001')->>'replayed'$$, CA, S1, I1));
  -- 5. reintento no duplica
  PERFORM pg_temp.c('reintento con misma clave no duplica', 'true', format($$SELECT public.mnt_sa_record_item_execution(%L, %L, %L, 'ok', 'Presión correcta', 0, 'e2e-key-0001')->>'replayed'$$, CA, S1, I1));
  PERFORM pg_temp.c('una única ejecución registrada', '1', format($$SELECT count(*) FROM public.mnt_item_execution_keys WHERE item_id = %L$$, I1));
  -- 6. queda otro equipo pendiente; operario no cierra ni justifica
  PERFORM pg_temp.c('equipo 2 sigue pendiente', 'pending', format($$SELECT result FROM public.maintenance_items WHERE id = %L$$, I2));
  PERFORM pg_temp.c('operario A no puede cerrar', 'rej:42501', format($$SELECT public.mnt_sa_close_session(%L, %L, 'Op', NULL, 'sig')::text$$, CA, S1));
  PERFORM pg_temp.c('operario A no puede registrar excepción', 'rej:42501', format($$SELECT public.mnt_sa_record_closure_exception(%L, %L, 'inaccessible', 'No llego')::text$$, CA, I2));
  PERFORM pg_temp.c('operario A no puede asignar', 'rej:42501', format($$SELECT public.mnt_sa_assign_session_people(%L, %L, ARRAY[%L]::uuid[])::text$$, CA, S1, OPB));
  PERFORM pg_temp.c('operario A no marca exceptuado por RLS', '0', format($$WITH x AS (UPDATE public.maintenance_items SET result = 'excepted' WHERE id = %L RETURNING 1) SELECT count(*) FROM x$$, I2));
  -- 7. operario B (misma empresa, no asignado) no obtiene datos
  PERFORM pg_temp.act(OPB);
  PERFORM pg_temp.c('no asignado: 0 sesiones visibles', '0', format($$SELECT count(*) FROM public.maintenance_sessions WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('no asignado: 0 equipos visibles', '0', format($$SELECT count(*) FROM public.maintenance_items WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('no asignado: 0 respuestas visibles', '0', format($$SELECT count(*) FROM public.checklist_responses WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('no asignado: QR genérico', 'not_available', format($$SELECT public.mnt_sa_resolve_scan(%L)->>'status'$$, TOK1));
  PERFORM pg_temp.c('no asignado: no ejecuta', 'rej:42501', format($$SELECT public.mnt_sa_record_item_execution(%L, %L, %L, 'ok', NULL, 0, 'e2e-key-0099')::text$$, CA, S1, I2));
  -- 8. supervisor registra excepción motivada y cierra
  PERFORM pg_temp.act(SUP);
  PERFORM pg_temp.c('cierre bloqueado con pendiente', 'rej:23514', format($$SELECT public.mnt_sa_close_session(%L, %L, 'Supervisor', 'Jefe', 'sig')::text$$, CA, S1));
  PERFORM pg_temp.c('excepción sin motivo rechazada', 'rej:23514', format($$SELECT public.mnt_sa_record_closure_exception(%L, %L, 'other', ' ')::text$$, CA, I2));
  PERFORM pg_temp.c('supervisor registra excepción', 'true', format($$SELECT public.mnt_sa_record_closure_exception(%L, %L, 'inaccessible', 'Sala técnica cerrada con llave')->>'recorded_now'$$, CA, I2));
  PERFORM pg_temp.c('excepción no cuenta como revisado', 'excepted', format($$SELECT result FROM public.maintenance_items WHERE id = %L$$, I2));
  PERFORM pg_temp.c('supervisor cierra', 'true', format($$SELECT public.mnt_sa_close_session(%L, %L, 'Supervisor E2E', 'Jefe', 'sig')->>'closed_now'$$, CA, S1));
  PERFORM pg_temp.c('excepción inmutable', 'rej:42501', format($$UPDATE public.mnt_session_item_exceptions SET reason_text = 'x' WHERE item_id = %L RETURNING 'changed'$$, I2));
  -- 9. historial de cierre: ejecutores, resultados y excepción
  RESET ROLE;
  SELECT e.summary INTO summary FROM public.mnt_session_closure_events e WHERE e.session_id = S1;
  INSERT INTO e2e SELECT (SELECT max(n) FROM e2e) + 1, 'historial: ejecutor = operario A con 1 equipo', 'true',
    (summary->'executors'->0->>'user_id' = OPA::text AND (summary->'executors'->0->>'items')::int = 1 AND jsonb_array_length(summary->'executors') = 1)::text;
  INSERT INTO e2e SELECT (SELECT max(n) FROM e2e) + 1, 'historial: resultados 1 ok / 1 excepted', 'true',
    ((summary->'totals'->>'ok')::int = 1 AND (summary->'totals'->>'excepted')::int = 1)::text;
  INSERT INTO e2e SELECT (SELECT max(n) FROM e2e) + 1, 'historial: excepción con equipo, motivo, persona y fecha', 'true',
    (summary->'exceptions'->0->'asset'->>'code' = 'E2E-002' AND summary->'exceptions'->0->>'code' = 'inaccessible'
     AND summary->'exceptions'->0->>'text' = 'Sala técnica cerrada con llave' AND summary->'exceptions'->0->>'by' = SUP::text
     AND summary->'exceptions'->0->>'at' IS NOT NULL)::text;
  INSERT INTO e2e SELECT (SELECT max(n) FROM e2e) + 1, 'resultado de sesión incompleto (no OK)', 'incomplete',
    (SELECT outcome FROM public.maintenance_sessions WHERE id = S1);
  -- certificate as emitted by the host after close (certificate + items linked to the session)
  INSERT INTO public.certificates(id, company_id, code, title, issued_on, issuer_name, status)
    VALUES (CERT, CA, 'E2E-CERT', 'Certificado E2E', current_date, 'Supervisor E2E', 'issued');
  INSERT INTO public.certificate_items(certificate_id, company_id, asset_id, maintenance_session_id, maintenance_item_id, result)
    VALUES (CERT, CA, A1, S1, I1, 'ok'), (CERT, CA, A2, S1, I2, 'na');
  -- 10. lecturas posteriores al cierre
  PERFORM pg_temp.act(OPA);
  PERFORM pg_temp.c('operario A ve su historial de cierre', '1', format($$SELECT count(*) FROM public.mnt_session_closure_events WHERE session_id = %L$$, S1));
  PERFORM pg_temp.c('operario A ve el certificado de su sesión', '1', format($$SELECT count(*) FROM public.certificates WHERE id = %L$$, CERT));
  PERFORM pg_temp.act(OPB);
  PERFORM pg_temp.c('no asignado: sin historial de cierre', '0', format($$SELECT count(*) FROM public.mnt_session_closure_events WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('no asignado: sin excepciones', '0', format($$SELECT count(*) FROM public.mnt_session_item_exceptions WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('no asignado: sin certificado', '0', format($$SELECT count(*) FROM public.certificates WHERE id = %L$$, CERT));
  PERFORM pg_temp.c('no asignado: sin líneas de certificado', '0', format($$SELECT count(*) FROM public.certificate_items WHERE certificate_id = %L$$, CERT));
  PERFORM pg_temp.c('no asignado: sin asignaciones', '0', format($$SELECT count(*) FROM public.mnt_session_assignees WHERE company_id = %L$$, CA));
  -- 11. otra empresa: OPB sale de A y es admin de B
  RESET ROLE;
  UPDATE public.company_members SET active = false WHERE company_id = CA AND user_id = OPB;
  PERFORM pg_temp.act(OPB);
  PERFORM pg_temp.c('otra empresa: 0 sesiones de A', '0', format($$SELECT count(*) FROM public.maintenance_sessions WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('otra empresa: 0 certificados de A', '0', format($$SELECT count(*) FROM public.certificates WHERE company_id = %L$$, CA));
  PERFORM pg_temp.c('otra empresa: QR genérico', 'not_available', format($$SELECT public.mnt_sa_resolve_scan(%L)->>'status'$$, TOK1));
  PERFORM pg_temp.c('otra empresa: cierre genérico', 'rej:P0002', format($$SELECT public.mnt_sa_close_session(%L, %L, 'x', NULL, 'sig')::text$$, CA, S2));
  PERFORM pg_temp.c('otra empresa: personas vacías', '[]', format($$SELECT public.mnt_sa_list_session_people(%L, %L)::text$$, CA, S1));
  -- 12. supervisor conserva visibilidad completa tras el cierre
  PERFORM pg_temp.act(SUP);
  PERFORM pg_temp.c('supervisor ve excepción y cierre', '2', format($$SELECT (SELECT count(*) FROM public.mnt_session_item_exceptions WHERE session_id = %L) + (SELECT count(*) FROM public.mnt_session_closure_events WHERE session_id = %L)$$, S1, S1));
  RESET ROLE;

  FOR j IN SELECT to_jsonb(e) FROM e2e e ORDER BY n LOOP
    total := total + 1; ok := j->>'expected' = j->>'actual';
    IF ok THEN passed := passed + 1; ELSE fails := fails || format(' [%s %s: esperado %s, obtenido %s]', j->>'n', j->>'name', j->>'expected', j->>'actual'); END IF;
    results := results || format(E'\n%s %s %s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, j->>'n', j->>'name');
  END LOOP;
  RAISE EXCEPTION 'MNT_QR_E2E RESULTADO %/% % SUMMARY=% %', passed, total, CASE WHEN fails = '' THEN '' ELSE ' FALLOS:' || fails END, summary::text, results;
END
$run$;
