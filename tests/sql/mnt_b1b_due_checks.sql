-- Bloque 1B — vencimientos: pruebas contra la base de la app dentro de una transacción que SIEMPRE se revierte
-- (el bloque termina con RAISE EXCEPTION). Ejecutar con: psql -f tests/sql/mnt_b1b_due_checks.sql
-- Org B (Sistach) = organización de trabajo; UB administrador; UA se añade como 'manager' de B solo dentro de la prueba.
DO $run$
DECLARE
  total int := 0; passed int := 0; fails text := '';
  r record; v text; c bigint; q text; k text; val text;
  UA constant uuid := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  UB constant uuid := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  CA constant uuid := 'e5b35c19-afd3-4675-9654-070e8a8ffc7d';
  CB constant uuid := 'f80df1ea-1d54-43f1-9330-e35d277c91a6';
  T uuid; F uuid; i int;
  tok jsonb := jsonb_build_object(':CA', CA, ':CB', CB,
    ':P1', '00000000-0000-4000-8000-00000001b001', ':P2', '00000000-0000-4000-8000-00000001b002', ':P3', '00000000-0000-4000-8000-00000001b003',
    ':S1', '00000000-0000-4000-8000-00000002b001', ':S2', '00000000-0000-4000-8000-00000002b002', ':S3', '00000000-0000-4000-8000-00000002b003',
    ':S4', '00000000-0000-4000-8000-00000002b004', ':S5', '00000000-0000-4000-8000-00000002b005');
BEGIN
  SELECT id INTO T FROM public.asset_types WHERE company_id = CB LIMIT 1;
  SELECT id INTO F FROM public.asset_families WHERE company_id = CB LIMIT 1;
  INSERT INTO public.company_members(company_id, user_id, role, active) VALUES (CB, UA, 'manager', true);
  INSERT INTO public.maintenance_plans(id, company_id, code, name, frequency, interval_months, asset_family_id) VALUES
    ('00000000-0000-4000-8000-00000001b001', CB, 'B1B-P1', 'Mensual 5', 'monthly', NULL, F),
    ('00000000-0000-4000-8000-00000001b002', CB, 'B1B-P2', 'Anual 50', 'annual', NULL, F),
    ('00000000-0000-4000-8000-00000001b003', CB, 'B1B-P3', 'Externo 5', 'annual', NULL, F);
  UPDATE public.maintenance_plans SET execution_mode = 'external' WHERE id = '00000000-0000-4000-8000-00000001b003';
  FOR i IN 1..60 LOOP
    INSERT INTO public.assets(id, company_id, asset_type_id, code, name, status)
    VALUES (('00000000-0000-4000-8000-0000003' || lpad(i::text, 5, '0'))::uuid, CB, T, 'B1B-' || i, 'Extintor ' || i, 'active');
  END LOOP;
  -- P1: assets 1..5, P2: 6..55, P3: 56..60
  INSERT INTO public.maintenance_plan_assets(id, plan_id, asset_id, start_on)
  SELECT ('00000000-0000-4000-8000-0000004' || lpad(g::text, 5, '0'))::uuid,
         CASE WHEN g <= 5 THEN '00000000-0000-4000-8000-00000001b001'::uuid WHEN g <= 55 THEN '00000000-0000-4000-8000-00000001b002'::uuid
              ELSE '00000000-0000-4000-8000-00000001b003'::uuid END,
         ('00000000-0000-4000-8000-0000003' || lpad(g::text, 5, '0'))::uuid, DATE '2025-01-01'
    FROM generate_series(1, 60) g;
  -- Sessions: S1 P1 (5 ok, distinct times), S2 P2 (47 ok + 3 pending), S3 P1 (incident), S4 P1 (N/A), S5 P3 external
  INSERT INTO public.maintenance_sessions(id, company_id, code, plan_id, status) VALUES
    ('00000000-0000-4000-8000-00000002b001', CB, 'B1B-S1', '00000000-0000-4000-8000-00000001b001', 'in_progress'),
    ('00000000-0000-4000-8000-00000002b002', CB, 'B1B-S2', '00000000-0000-4000-8000-00000001b002', 'in_progress'),
    ('00000000-0000-4000-8000-00000002b003', CB, 'B1B-S3', '00000000-0000-4000-8000-00000001b001', 'in_progress'),
    ('00000000-0000-4000-8000-00000002b004', CB, 'B1B-S4', '00000000-0000-4000-8000-00000001b001', 'in_progress'),
    ('00000000-0000-4000-8000-00000002b005', CB, 'B1B-S5', '00000000-0000-4000-8000-00000001b003', 'draft');
  -- S1: executed 31-ene 23:30 Madrid (22:30 UTC) and other distinct dates
  INSERT INTO public.maintenance_items(id, session_id, asset_id, result, completed_at) VALUES
    ('00000000-0000-4000-8000-000000050001', '00000000-0000-4000-8000-00000002b001', '00000000-0000-4000-8000-000000300001', 'ok', '2026-01-31T22:30:00Z'),
    ('00000000-0000-4000-8000-000000050002', '00000000-0000-4000-8000-00000002b001', '00000000-0000-4000-8000-000000300002', 'ok', '2026-01-31T23:30:00Z'),
    ('00000000-0000-4000-8000-000000050003', '00000000-0000-4000-8000-00000002b001', '00000000-0000-4000-8000-000000300003', 'ok', '2026-03-10T10:00:00Z'),
    ('00000000-0000-4000-8000-000000050004', '00000000-0000-4000-8000-00000002b001', '00000000-0000-4000-8000-000000300004', 'ok', '2028-02-29T10:00:00Z'),
    ('00000000-0000-4000-8000-000000050005', '00000000-0000-4000-8000-00000002b001', '00000000-0000-4000-8000-000000300005', 'ok', '2026-05-20T10:00:00Z');
  INSERT INTO public.maintenance_items(session_id, asset_id, result, completed_at)
  SELECT '00000000-0000-4000-8000-00000002b002', ('00000000-0000-4000-8000-0000003' || lpad(g::text, 5, '0'))::uuid,
         CASE WHEN g <= 52 THEN 'ok' ELSE 'pending' END, CASE WHEN g <= 52 THEN TIMESTAMPTZ '2026-06-15T10:00:00Z' END
    FROM generate_series(6, 55) g;
  INSERT INTO public.maintenance_items(id, session_id, asset_id, result, completed_at) VALUES
    ('00000000-0000-4000-8000-000000060001', '00000000-0000-4000-8000-00000002b003', '00000000-0000-4000-8000-000000300001', 'with_incident', '2026-04-01T10:00:00Z'),
    ('00000000-0000-4000-8000-000000060002', '00000000-0000-4000-8000-00000002b003', '00000000-0000-4000-8000-000000300002', 'with_incident', '2026-04-01T10:00:00Z'),
    ('00000000-0000-4000-8000-000000070001', '00000000-0000-4000-8000-00000002b004', '00000000-0000-4000-8000-000000300003', 'not_applicable', '2026-04-01T10:00:00Z');
  INSERT INTO public.maintenance_items(id, session_id, asset_id, result)
  SELECT ('00000000-0000-4000-8000-0000000800' || lpad(g::text, 2, '0'))::uuid, '00000000-0000-4000-8000-00000002b005',
         ('00000000-0000-4000-8000-0000003' || lpad(g::text, 5, '0'))::uuid, 'pending'
    FROM generate_series(56, 60) g;

  FOR r IN SELECT * FROM (VALUES
  -- Primera fecha en lote y reprogramación (permiso de gestión de planes)
  (1,'manager','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_set_due(':CB', '[{"plan_asset_id":"00000000-0000-4000-8000-000000400001","due":"2026-02-01"}]'::jsonb)$$),
  (2,'admin','B','authenticated','exec','ok',$$SELECT public.mnt_sa_set_due(':CB', '[{"plan_asset_id":"00000000-0000-4000-8000-000000400001","due":"2026-01-31"},{"plan_asset_id":"00000000-0000-4000-8000-000000400002","due":"2026-02-15"},{"plan_asset_id":"00000000-0000-4000-8000-000000400003","due":"2026-03-01"},{"plan_asset_id":"00000000-0000-4000-8000-000000400004","due":"2028-02-01"}]'::jsonb)$$),
  (3,'propietario','-','-','count','rows:4',$$SELECT 1 FROM public.mnt_due_changes WHERE plan_id=':P1' AND kind='initial' AND reason IS NULL AND changed_by='fbf169ac-47e9-4061-a3b2-c9e030e1f214'$$),
  (4,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_set_due(':CB', '[{"plan_asset_id":"00000000-0000-4000-8000-000000400003","due":"2026-03-05"}]'::jsonb)$$),
  (5,'admin','B','authenticated','exec','ok',$$SELECT public.mnt_sa_set_due(':CB', '[{"plan_asset_id":"00000000-0000-4000-8000-000000400003","due":"2026-03-05"}]'::jsonb, 'Coordinación con el proveedor')$$),
  (6,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_due_changes WHERE plan_asset_id='00000000-0000-4000-8000-000000400003' AND kind='reschedule' AND old_due='2026-03-01' AND new_due='2026-03-05' AND reason='Coordinación con el proveedor'$$),
  (7,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.maintenance_plan_assets SET next_due_on='2030-01-01' WHERE id='00000000-0000-4000-8000-000000400001'$$),
  (8,'admin','B','authenticated','exec','rej:42501',$$UPDATE public.mnt_due_changes SET reason='x'$$),
  (9,'admin','B','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_due_changes(company_id,plan_asset_id,plan_id,asset_id,kind,changed_by) VALUES (':CB',gen_random_uuid(),':P1',gen_random_uuid(),'initial',gen_random_uuid())$$),
  (10,'admin otra org','A0','authenticated','exec','rej:P0002',$$SELECT public.mnt_sa_set_due(':CA', '[{"plan_asset_id":"00000000-0000-4000-8000-000000400005","due":"2026-01-01"}]'::jsonb)$$),
  (11,'anon','-','anon','exec','rej:42501',$$SELECT public.mnt_sa_set_due(':CB', '[]'::jsonb)$$),
  -- Cierre interno: 5 equipos conformes con fechas previstas distintas; cada uno avanza con la suya (mensual)
  (12,'admin otra org','A0','authenticated','exec','rej:P0002',$$SELECT public.mnt_sa_close_session(':CA', ':S1', 'X', NULL, 'sig')$$),
  (13,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_session(':CB', ':S1', 'Técnico', 'Mantenedor', 'sig')$$),
  (14,'propietario','-','-','count','rows:5',$$SELECT 1 FROM public.maintenance_plan_assets WHERE plan_id=':P1' AND (id, next_due_on) IN (
      ('00000000-0000-4000-8000-000000400001'::uuid, DATE '2026-02-28'), ('00000000-0000-4000-8000-000000400002'::uuid, DATE '2026-03-01'),
      ('00000000-0000-4000-8000-000000400003'::uuid, DATE '2026-04-10'), ('00000000-0000-4000-8000-000000400004'::uuid, DATE '2028-03-29'),
      ('00000000-0000-4000-8000-000000400005'::uuid, DATE '2026-06-20'))$$),
  (15,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_items WHERE id='00000000-0000-4000-8000-000000050003' AND metadata->'due'->>'planned_on'='2026-03-05' AND metadata->'due'->>'executed_on'='2026-03-10' AND (metadata->'due'->>'late')::boolean AND metadata->'due'->>'calendar_on'='2026-04-05'$$),
  (16,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_items WHERE id='00000000-0000-4000-8000-000000050004' AND metadata->'due'->>'planned_on'='2028-02-01' AND metadata->'due'->>'executed_on'='2028-02-29'$$),
  (17,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_items WHERE id='00000000-0000-4000-8000-000000050005' AND metadata->'due'->>'planned_on' IS NULL AND NOT (metadata->'due'->>'late')::boolean$$),
  (18,'propietario','-','-','count','rows:5',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S1' AND kind='close' AND changed_by='3b7de027-5b93-4336-a2a3-ececd12f7443'$$),
  (19,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S1' AND status='closed' AND metadata->>'outcome'='ok' AND jsonb_array_length(metadata->'close_snapshot'->'items')=5$$),
  -- Reintento: no repite cierre ni cambios
  (20,'manager','A','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_close_session(':CB', ':S1', 'Otro', NULL, 'sig')->>'closed_now')::boolean = false$$),
  (21,'propietario','-','-','count','rows:5',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S1'$$),
  (22,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S1' AND signer_name='Técnico'$$),
  -- 47 realizados + 3 omitidos
  (23,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_session(':CB', ':S2', 'Técnico', NULL, 'sig')$$),
  (24,'propietario','-','-','count','rows:47',$$SELECT 1 FROM public.maintenance_plan_assets WHERE plan_id=':P2' AND next_due_on='2027-06-15'$$),
  (25,'propietario','-','-','count','rows:3',$$SELECT 1 FROM public.maintenance_plan_assets WHERE plan_id=':P2' AND next_due_on IS NULL$$),
  (26,'propietario','-','-','count','rows:3',$$SELECT 1 FROM public.maintenance_items WHERE session_id=':S2' AND result='skipped' AND completed_at IS NULL AND NOT (metadata->'due'->>'advanced')::boolean$$),
  (27,'propietario','-','-','count','rows:47',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S2'$$),
  (28,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S2' AND metadata->>'outcome'='incomplete' AND (metadata->>'skipped_count')::int=3$$),
  -- Con incidencias: avanza por defecto; no avanzar exige motivo
  (29,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_session(':CB', ':S3', 'T', NULL, 'sig', '[{"item_id":"00000000-0000-4000-8000-000000060002","action":"keep"}]'::jsonb)$$),
  (30,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S3' AND status='in_progress'$$),
  (31,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_session(':CB', ':S3', 'T', NULL, 'sig', '[{"item_id":"00000000-0000-4000-8000-000000060002","action":"keep","reason":"Pendiente de reparar"}]'::jsonb)$$),
  (32,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-000000400001' AND next_due_on='2026-05-01'$$),
  (33,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-000000400002' AND next_due_on='2026-03-01'$$),
  (34,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S3' AND kind='no_advance' AND reason='Pendiente de reparar' AND old_due=new_due$$),
  -- Fecha manual distinta de la propuesta y del calendario exige motivo
  -- «No aplica» global: sin decisión no cierra; exención requiere motivo
  (35,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_session(':CB', ':S4', 'T', NULL, 'sig')$$),
  (36,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_close_session(':CB', ':S4', 'T', NULL, 'sig', '[{"item_id":"00000000-0000-4000-8000-000000070001","action":"advance","due":"2026-12-01"}]'::jsonb)$$),
  (37,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_session(':CB', ':S4', 'T', NULL, 'sig', '[{"item_id":"00000000-0000-4000-8000-000000070001","action":"advance","due":"2026-12-01","reason":"Equipo fuera de uso temporal"}]'::jsonb)$$),
  (38,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S4' AND kind='exemption' AND new_due='2026-12-01'$$),
  -- Externa con resultado común y excepciones por equipo
  (39,'manager','A','authenticated','exec','rej:22023',$$SELECT public.mnt_sa_record_external(':CB', ':S5', '2026-09-30', 'Extintores SL', 'INF-1', 'ok', NULL, '[{"item_id":"00000000-0000-4000-8000-000000000999","result":"with_incident"}]'::jsonb)$$),
  (40,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_record_external(':CB', ':S5', '2026-09-30', 'Extintores SL', 'INF-1', 'ok', NULL, '[{"item_id":"00000000-0000-4000-8000-000000080056","result":"with_incident","note":"Presión baja"},{"item_id":"00000000-0000-4000-8000-000000080057","result":"with_incident"}]'::jsonb)$$),
  (41,'propietario','-','-','count','rows:5',$$SELECT 1 FROM public.maintenance_plan_assets WHERE plan_id=':P3' AND next_due_on='2027-09-30'$$),
  (42,'propietario','-','-','count','rows:2',$$SELECT 1 FROM public.maintenance_items WHERE session_id=':S5' AND result='with_incident'$$),
  (43,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id=':S5' AND status='closed' AND outcome='with_incidents' AND metadata->'external'->>'performed_on'='2026-09-30'$$),
  (44,'manager','A','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_record_external(':CB', ':S5', '2026-09-30', 'Extintores SL', NULL, 'ok', NULL)->>'closed_now')::boolean = false$$),
  (45,'propietario','-','-','count','rows:5',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id=':S5'$$),
  -- Aislamiento de la bitácora
  (46,'admin otra org','A0','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_due_changes WHERE company_id=':CB'$$),
  (47,'admin','B','authenticated','count','rows:61',$$SELECT 1 FROM public.mnt_due_changes WHERE plan_id IN (':P1',':P2',':P3')$$)
   ) t(n, actor, who, role, kind, expected, sql) ORDER BY n
  LOOP
    q := r.sql;
    FOR k, val IN SELECT key, value FROM jsonb_each_text(tok) ORDER BY length(key) DESC LOOP q := replace(q, k, val); END LOOP;
    PERFORM set_config('request.jwt.claims', CASE r.who
      WHEN 'A' THEN json_build_object('sub', UA, 'role', 'authenticated')::text
      WHEN 'A0' THEN json_build_object('sub', UA, 'role', 'authenticated')::text
      WHEN 'B' THEN json_build_object('sub', UB, 'role', 'authenticated')::text
      ELSE '{"role":"anon"}' END, true);
    -- 'A0' = UA acting as administrator of its own org (Toni) against org B's data
    BEGIN
      IF r.role <> '-' THEN EXECUTE format('SET LOCAL ROLE %I', r.role); END IF;
      IF r.kind = 'count' THEN EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; v := 'rows:' || c;
      ELSIF r.kind = 'rows' THEN EXECUTE q; GET DIAGNOSTICS c = ROW_COUNT; v := 'rows:' || c;
      ELSE EXECUTE q; v := 'ok'; END IF;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      v := 'rej:' || SQLSTATE || CASE WHEN r.expected LIKE 'rej:%' OR r.expected LIKE 'rows:%' THEN '' ELSE ' ' || SQLERRM END;
    END;
    RESET ROLE;
    total := total + 1;
    IF v = r.expected THEN passed := passed + 1; ELSE fails := fails || format(' [%s %s: esperado %s, obtenido %s]', r.n, r.actor, r.expected, v); END IF;
  END LOOP;
  RAISE EXCEPTION 'MNT_B1B RESULTADO %/% %', passed, total, CASE WHEN fails = '' THEN '' ELSE ' FALLOS:' || fails END;
END
$run$;
