-- Bloque 2B — correctivo sencillo: pruebas contra la base de la app.
-- Transacción que SIEMPRE se revierte (RAISE EXCEPTION final). Org B (Sistach): UB administrador; UA 'employee' solo dentro de la prueba.
DO $run$
DECLARE
  total int := 0; passed int := 0; fails text := ''; results text := '';
  r record; v text; c bigint; q text; k text; val text;
  UA constant uuid := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  UB constant uuid := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  CA constant uuid := 'e5b35c19-afd3-4675-9654-070e8a8ffc7d';
  CB constant uuid := 'f80df1ea-1d54-43f1-9330-e35d277c91a6';
  T uuid; F uuid; S1 uuid; S2 uuid; S3 uuid; S4 uuid;
  tok jsonb;
BEGIN
  SELECT id INTO T FROM public.asset_types WHERE company_id = CB LIMIT 1;
  SELECT id INTO F FROM public.asset_families WHERE company_id = CB LIMIT 1;
  INSERT INTO public.company_members(company_id, user_id, role, active) VALUES (CB, UA, 'employee', true);
  INSERT INTO public.assets(id, company_id, asset_type_id, code, name, status) VALUES
    ('00000000-0000-4000-8000-0000000b0011', CB, T, 'T2B-1', 'Extintor TEST', 'active'),
    ('00000000-0000-4000-8000-0000000b0012', CB, T, 'T2B-2', 'Clima TEST', 'active'),
    ('00000000-0000-4000-8000-0000000b0013', CB, T, 'T2B-3', 'Retirado TEST', 'retired');
  INSERT INTO public.maintenance_plans(id, company_id, code, name, frequency, asset_family_id, execution_mode) VALUES
    ('00000000-0000-4000-8000-0000000b0001', CB, 'T2B-P1', 'Anual', 'annual', F, 'internal');
  INSERT INTO public.maintenance_plan_assets(id, plan_id, asset_id, start_on, next_due_on) VALUES
    ('00000000-0000-4000-8000-0000000b0021', '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0011', DATE '2025-01-01', DATE '2027-01-15');
  INSERT INTO public.incidents(id, company_id, code, title, asset_id, status) VALUES
    ('00000000-0000-4000-8000-0000000b0061', CB, 'T2B-X1', 'TEST incidencia clima', '00000000-0000-4000-8000-0000000b0012', 'open'),
    ('00000000-0000-4000-8000-0000000b0062', CA, 'T2B-X0', 'TEST otra org', NULL, 'open');

  -- Correctivos creados por el administrador para los casos
  PERFORM set_config('request.jwt.claims', json_build_object('sub', UB, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  S1 := (public.mnt_sa_create_corrective(CB, '00000000-0000-4000-8000-0000000b0011', current_date - 3, 'high', 'Manómetro en rojo', NULL, true, 'Proveedor TEST', NULL, true)->>'id')::uuid;
  S2 := (public.mnt_sa_create_corrective(CB, '00000000-0000-4000-8000-0000000b0012', current_date - 5, 'normal', 'No enfría', '00000000-0000-4000-8000-0000000b0061')->>'id')::uuid;
  S3 := (public.mnt_sa_create_corrective(CB, '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'Ruido', NULL, false, NULL, NULL, false, '00000000-0000-4000-8000-0000000b0099')->>'id')::uuid;
  S4 := (public.mnt_sa_create_corrective(CB, '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'Para cancelar')->>'id')::uuid;
  RESET ROLE;
  tok := jsonb_build_object(':CA', CA, ':CB', CB, ':S1', S1, ':S2', S2, ':S3', S3, ':S4', S4);

  FOR r IN SELECT * FROM (VALUES
  (1,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions s JOIN public.maintenance_items i ON i.session_id=s.id WHERE s.id=':S1' AND s.kind='corrective' AND s.plan_id IS NULL AND s.status='in_progress' AND s.code LIKE 'REP-%' AND i.asset_id='00000000-0000-4000-8000-0000000b0011'$$),
  (2,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.assets WHERE id='00000000-0000-4000-8000-0000000b0011' AND status='out_of_service'$$),
  (3,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.assets WHERE id='00000000-0000-4000-8000-0000000b0012' AND status='active'$$),
  (4,'empleado','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'x', NULL, false, NULL, NULL, true)$$),
  (5,'empleado','A','authenticated','exec','ok',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'Sin marcar averiado')$$),
  (6,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date + 1, 'low', 'x')$$),
  (7,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0013', current_date, 'low', 'x')$$),
  (8,'admin','B','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'x', '00000000-0000-4000-8000-0000000b0062')$$),
  (9,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0011', current_date, 'low', 'x', '00000000-0000-4000-8000-0000000b0061')$$),
  (10,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'Ruido', NULL, false, NULL, NULL, false, '00000000-0000-4000-8000-0000000b0099')->>'created_now')::boolean$$),
  (11,'empleado','A','authenticated','exec','ok',$$SELECT public.mnt_sa_add_entry(':CB', ':S2', current_date - 4, 'Diagnóstico')$$),
  (12,'empleado','A','authenticated','exec','ok',$$SELECT public.mnt_sa_add_entry(':CB', ':S2', current_date - 1, 'Pedido de compresor')$$),
  (13,'empleado','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_add_entry(':CB', ':S2', current_date - 9, 'antes de detectar')$$),
  (14,'empleado','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_add_entry(':CB', ':S2', current_date + 1, 'futuro')$$),
  (15,'propietario','-','-','exec','rej:42501',$$UPDATE public.mnt_session_entries SET body='x' WHERE session_id=':S2'$$),
  (16,'propietario','-','-','exec','rej:42501',$$DELETE FROM public.mnt_session_entries WHERE session_id=':S2'$$),
  (17,'admin','B','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_session_entries(company_id, session_id, performed_on, body) VALUES (':CB', ':S2', current_date, 'directo')$$),
  (18,'admin','B','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_close_session(':CB', ':S1', 'Técnico', NULL, 'sig')$$),
  (19,'admin','B','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_record_external(':CB', ':S1', current_date, 'Prov', NULL, 'ok', NULL)$$),
  (20,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_sessions SET status='closed' WHERE id=':S1'$$),
  (21,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_items SET result='ok' WHERE session_id=':S1'$$),
  (22,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_sessions SET kind='preventive' WHERE id=':S1'$$),
  (23,'empleado','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_corrective(':CB', ':S2', current_date, 'not_repaired', '')$$),
  (24,'empleado','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_corrective(':CB', ':S2', current_date, 'not_repaired', 'Falta pieza', NULL, NULL, true)$$),
  (25,'empleado','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_corrective(':CB', ':S2', current_date - 6, 'repaired')$$),
  (26,'empleado','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_corrective(':CB', ':S2', current_date - 1, 'not_repaired', 'Falta compresor')$$),
  (27,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.incidents WHERE id='00000000-0000-4000-8000-0000000b0061' AND status='open' AND resolved_at IS NULL AND closed_at IS NULL$$),
  (28,'empleado','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_close_corrective(':CB', ':S1', current_date - 1, 'repaired', NULL, 'Proveedor TEST', 'P-1', true)$$),
  (29,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_close_corrective(':CB', ':S1', current_date - 2, 'repaired', 'Recarga', 'Proveedor TEST', 'P-1', true)->>'reactivated')::boolean$$),
  (30,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.assets WHERE id='00000000-0000-4000-8000-0000000b0011' AND status='active'$$),
  (31,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000b0021' AND next_due_on='2027-01-15'$$),
  (32,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id IN (':S1', ':S2') OR plan_asset_id='00000000-0000-4000-8000-0000000b0021'$$),
  (33,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions s JOIN public.maintenance_items i ON i.session_id=s.id WHERE s.id=':S1' AND s.status='closed' AND s.outcome='repaired' AND s.closed_at IS NOT NULL AND i.completed_at::date = current_date - 2 AND s.detected_on = current_date - 3 AND s.metadata->'corrective_close'->>'by'='fbf169ac-47e9-4061-a3b2-c9e030e1f214'$$),
  (34,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_close_corrective(':CB', ':S1', current_date, 'replaced')->>'closed_now')::boolean$$),
  (35,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S1' AND outcome='repaired'$$),
  (36,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_add_entry(':CB', ':S1', current_date, 'tarde')$$),
  (37,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_sessions SET notes='cambio' WHERE id=':S1'$$),
  (38,'propietario','-','-','exec','rej:23514',$$INSERT INTO public.certificate_items(certificate_id, maintenance_session_id, result) SELECT id, ':S1', 'ok' FROM public.certificates WHERE company_id=':CB' LIMIT 1$$),
  (39,'propietario','-','-','exec','rej:23514',$$INSERT INTO public.mnt_due_changes(company_id, plan_asset_id, session_id, kind, new_due_on, reason) VALUES (':CB', '00000000-0000-4000-8000-0000000b0021', ':S1', 'due_change', '2030-01-01', 'x')$$),
  (40,'empleado','A','authenticated','exec','ok',$$SELECT public.mnt_sa_cancel_session(':CB', ':S4', 'Era otro equipo')$$),
  (41,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S4' AND status='cancelled' AND metadata->'cancel'->>'reason'='Era otro equipo'$$),
  (42,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_sessions SET status='in_progress' WHERE id=':S4'$$),
  (43,'admin','B','authenticated','exec','ok',$$SELECT public.mnt_sa_link_incident(':CB', ':S3', '00000000-0000-4000-8000-0000000b0061')$$),
  (44,'admin','B','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_link_incident(':CB', ':S3', '00000000-0000-4000-8000-0000000b0062')$$),
  (45,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_sessions SET incident_id='00000000-0000-4000-8000-0000000b0062' WHERE id=':S3'$$),
  (46,'propietario','-','-','exec','rej:23514',$$INSERT INTO public.maintenance_sessions(company_id, code, status, kind) VALUES (':CB', 'T2B-BAD', 'draft', 'preventive')$$),
  (47,'propietario','-','-','exec','rej:23514',$$INSERT INTO public.maintenance_sessions(company_id, code, plan_id, status, kind, detected_on, priority, fault_description) VALUES (':CB', 'T2B-BAD2', '00000000-0000-4000-8000-0000000b0001', 'draft', 'corrective', current_date, 'low', 'x')$$),
  (48,'propietario','-','-','exec','ok',$$INSERT INTO public.maintenance_sessions(company_id, code, status, kind) VALUES (':CB', 'T2B-LEG', 'draft', 'legacy')$$),
  (49,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.maintenance_sessions WHERE plan_id IS NULL AND kind='preventive'$$),
  (50,'anon','-','anon','exec','rej:42501',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'x')$$),
  (51,'propietario','-','-','exec','ok',$$DELETE FROM public.company_members WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443' AND company_id=':CB'$$),
  (52,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_create_corrective(':CB', '00000000-0000-4000-8000-0000000b0012', current_date, 'low', 'x')$$),
  (53,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_add_entry(':CB', ':S3', current_date, 'x')$$),
  (54,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_close_corrective(':CB', ':S3', current_date, 'repaired')$$),
  (55,'admin otra org','A0','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_session_entries WHERE session_id=':S2'$$)
   ) t(n, actor, who, role, kind, expected, sql) ORDER BY n
  LOOP
    q := r.sql;
    FOR k, val IN SELECT key, value FROM jsonb_each_text(tok) ORDER BY length(key) DESC LOOP q := replace(q, k, val); END LOOP;
    PERFORM set_config('request.jwt.claims', CASE r.who
      WHEN 'A' THEN json_build_object('sub', UA, 'role', 'authenticated')::text
      WHEN 'A0' THEN json_build_object('sub', UA, 'role', 'authenticated')::text
      WHEN 'B' THEN json_build_object('sub', UB, 'role', 'authenticated')::text
      ELSE '{"role":"anon"}' END, true);
    BEGIN
      IF r.role <> '-' THEN EXECUTE format('SET LOCAL ROLE %I', r.role); END IF;
      IF r.kind = 'count' THEN EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; v := 'rows:' || c;
      ELSE EXECUTE q; v := 'ok'; END IF;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v := 'rej:' || SQLSTATE || CASE WHEN r.expected LIKE 'rej:%' OR r.expected LIKE 'rows:%' THEN '' ELSE ' ' || SQLERRM END;
    END;
    RESET ROLE;
    total := total + 1;
    results := results || format(E'\n%s %s (%s): esperado %s, obtenido %s', CASE WHEN v = r.expected THEN 'PASS' ELSE 'FAIL' END, r.n, r.actor, r.expected, v);
    IF v = r.expected THEN passed := passed + 1; ELSE fails := fails || format(' [%s %s: esperado %s, obtenido %s]', r.n, r.actor, r.expected, v); END IF;
  END LOOP;
  RAISE EXCEPTION 'MNT_2B RESULTADO %/% % %', passed, total, CASE WHEN fails = '' THEN '' ELSE ' FALLOS:' || fails END, results;
END
$run$;
