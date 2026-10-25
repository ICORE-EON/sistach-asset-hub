-- Bloque 2A — edición/desactivación/eliminación controlada: pruebas contra la base de la app.
-- Transacción que SIEMPRE se revierte (RAISE EXCEPTION final). Requiere privilegios de propietario (SET ROLE).
-- Org B (Sistach): UB administrador; UA se añade como 'manager' solo dentro de la prueba. Registros T2A-*.
DO $run$
DECLARE
  total int := 0; passed int := 0; fails text := ''; results text := '';
  r record; v text; c bigint; q text; k text; val text;
  UA constant uuid := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  UB constant uuid := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  CA constant uuid := 'e5b35c19-afd3-4675-9654-070e8a8ffc7d';
  CB constant uuid := 'f80df1ea-1d54-43f1-9330-e35d277c91a6';
  T uuid; F uuid;
  tok jsonb := jsonb_build_object(':CA', CA, ':CB', CB);
BEGIN
  SELECT id INTO T FROM public.asset_types WHERE company_id = CB LIMIT 1;
  SELECT id INTO F FROM public.asset_families WHERE company_id = CB LIMIT 1;
  INSERT INTO public.company_members(company_id, user_id, role, active) VALUES (CB, UA, 'manager', true);
  INSERT INTO public.maintenance_plans(id, company_id, code, name, frequency, asset_family_id, execution_mode) VALUES
    ('00000000-0000-4000-8000-0000000a0001', CB, 'T2A-Q1', 'Anual', 'annual', F, 'internal'), ('00000000-0000-4000-8000-0000000a0002', CB, 'T2A-Q2', 'Con borrador', 'annual', F, 'internal'),
    ('00000000-0000-4000-8000-0000000a0003', CB, 'T2A-Q3', 'Erróneo', 'annual', F, 'internal');
  INSERT INTO public.assets(id, company_id, asset_type_id, code, name, status) VALUES
    ('00000000-0000-4000-8000-0000000a0011', CB, T, 'T2A-1', 'A1', 'active'), ('00000000-0000-4000-8000-0000000a0012', CB, T, 'T2A-2', 'A2', 'active'), ('00000000-0000-4000-8000-0000000a0013', CB, T, 'T2A-3', 'A3', 'active'),
    ('00000000-0000-4000-8000-0000000a0014', CB, T, 'T2A-4', 'A4', 'active'), ('00000000-0000-4000-8000-0000000a0015', CB, T, 'T2A-5', 'A5', 'active');
  INSERT INTO public.maintenance_plan_assets(id, plan_id, asset_id, start_on) VALUES
    ('00000000-0000-4000-8000-0000000a0021', '00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a0011', DATE '2025-01-01'), ('00000000-0000-4000-8000-0000000a0022', '00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a0012', DATE '2025-01-01'),
    ('00000000-0000-4000-8000-0000000a0023', '00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a0013', (now() AT TIME ZONE 'Europe/Madrid')::date), ('00000000-0000-4000-8000-0000000a0024', '00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000a0014', DATE '2025-01-01');
  INSERT INTO public.maintenance_sessions(id, company_id, code, plan_id, status, notes, metadata) VALUES
    ('00000000-0000-4000-8000-0000000a0031', CB, 'T2A-S1', '00000000-0000-4000-8000-0000000a0001', 'in_progress', NULL, '{}'), ('00000000-0000-4000-8000-0000000a0032', CB, 'T2A-S2', '00000000-0000-4000-8000-0000000a0001', 'draft', NULL, '{}'),
    ('00000000-0000-4000-8000-0000000a0033', CB, 'T2A-S3', '00000000-0000-4000-8000-0000000a0002', 'draft', 'trabajo anotado', '{}'), ('00000000-0000-4000-8000-0000000a0034', CB, 'T2A-S4', '00000000-0000-4000-8000-0000000a0003', 'draft', NULL, '{}'),
    ('00000000-0000-4000-8000-0000000a0035', CB, 'T2A-S5', '00000000-0000-4000-8000-0000000a0001', 'closed', NULL, '{}'),
    ('00000000-0000-4000-8000-0000000a0036', CB, 'T2A-S6', '00000000-0000-4000-8000-0000000a0001', 'in_progress', NULL, '{"snapshot":{"plan":{"frequency":"monthly","interval_months":1}}}');
  INSERT INTO public.maintenance_items(id, session_id, asset_id, result, completed_at) VALUES
    ('00000000-0000-4000-8000-0000000a0041', '00000000-0000-4000-8000-0000000a0031', '00000000-0000-4000-8000-0000000a0012', 'ok', now()), ('00000000-0000-4000-8000-0000000a0042', '00000000-0000-4000-8000-0000000a0031', '00000000-0000-4000-8000-0000000a0013', 'ok', now()), ('00000000-0000-4000-8000-0000000a0043', '00000000-0000-4000-8000-0000000a0032', '00000000-0000-4000-8000-0000000a0014', 'pending', NULL),
    ('00000000-0000-4000-8000-0000000a0045', '00000000-0000-4000-8000-0000000a0035', '00000000-0000-4000-8000-0000000a0013', 'ok', now()), ('00000000-0000-4000-8000-0000000a0046', '00000000-0000-4000-8000-0000000a0036', '00000000-0000-4000-8000-0000000a0014', 'ok', '2026-01-10T10:00:00Z');
  INSERT INTO public.documents(id, company_id, category, title, storage_bucket, storage_path, maintenance_session_id) VALUES
    ('00000000-0000-4000-8000-0000000a0051', CB, 'maintenance_evidence', 'T2A evidencia', 'documents', 'test-2a/evidencia.pdf', '00000000-0000-4000-8000-0000000a0035');
  INSERT INTO public.documents(id, company_id, category, title, storage_bucket, storage_path, asset_id) VALUES
    ('00000000-0000-4000-8000-0000000a0052', CB, 'asset_manual', 'T2A manual', 'documents', 'test-2a/manual.pdf', '00000000-0000-4000-8000-0000000a0015');
  INSERT INTO public.incidents(id, company_id, code, title, source_maintenance_item_id, asset_id) VALUES
    ('00000000-0000-4000-8000-0000000a0061', CB, 'T2A-X1', 'T2A incidencia', '00000000-0000-4000-8000-0000000a0045', '00000000-0000-4000-8000-0000000a0013');

  -- Regression outside the original 51-case count: client GUC is not deletion authority.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', UB, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('mnt.safe_delete', 'on', true);
  BEGIN
    DELETE FROM public.assets WHERE id='00000000-0000-4000-8000-0000000a0015';
    RAISE EXCEPTION 'FAIL bandera cliente autorizó borrado';
  EXCEPTION WHEN insufficient_privilege THEN
    results := results || E'\nPASS adicional: bandera cliente no autoriza borrado';
  END;
  PERFORM set_config('mnt.safe_delete', 'off', true);
  RESET ROLE;

  FOR r IN SELECT * FROM (VALUES
  (1,'manager','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0024', 'x')$$),
  (2,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0021', NULL)->>'action'='removed'$$),
  (3,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_due_changes WHERE plan_asset_id='00000000-0000-4000-8000-0000000a0021' AND kind='link_removed' AND reason='Corrección de alta' AND NOT EXISTS (SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000a0021')$$),
  (4,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0022', '  ')$$),
  (5,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0022', 'Equipo trasladado')->>'action'='unlink'$$),
  (6,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000a0022' AND end_on=(now() AT TIME ZONE 'Europe/Madrid')::date - 1 AND end_on >= start_on$$),
  (7,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0022', 'otra vez')->>'already')::boolean$$),
  (8,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_due_changes WHERE plan_asset_id='00000000-0000-4000-8000-0000000a0022' AND kind='unlink' AND reason='Equipo trasladado' AND changed_by='fbf169ac-47e9-4061-a3b2-c9e030e1f214'$$),
  (9,'admin','B','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0023', 'Vinculado hoy')$$),
  (10,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000a0023' AND end_on IS NULL$$),
  (11,'admin','B','authenticated','exec','rej:42501',$$DELETE FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000a0024'$$),
  (12,'admin','B','authenticated','exec','rej:42501',$$DELETE FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0032'$$),
  (13,'admin','B','authenticated','exec','rej:42501',$$DELETE FROM public.assets WHERE id='00000000-0000-4000-8000-0000000a0015'$$),
  (15,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_delete_draft_session(':CB', '00000000-0000-4000-8000-0000000a0033')$$),
  (16,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_delete_draft_session(':CB', '00000000-0000-4000-8000-0000000a0031')$$),
  (17,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_delete_draft_session(':CB', '00000000-0000-4000-8000-0000000a0032')$$),
  (18,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0032' UNION ALL SELECT 1 FROM public.maintenance_items WHERE id='00000000-0000-4000-8000-0000000a0043'$$),
  (19,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_cancel_session(':CB', '00000000-0000-4000-8000-0000000a0031', '')$$),
  (20,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_cancel_session(':CB', '00000000-0000-4000-8000-0000000a0031', 'Proveedor no vino')$$),
  (21,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0031' AND status='cancelled' AND metadata->'cancel'->>'reason'='Proveedor no vino' AND metadata->'cancel'->>'from_status'='in_progress'$$),
  (22,'manager','A','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_cancel_session(':CB', '00000000-0000-4000-8000-0000000a0031', 'otra')->>'cancelled_now')::boolean$$),
  (23,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.mnt_due_changes WHERE session_id='00000000-0000-4000-8000-0000000a0031'$$),
  (24,'manager','A','authenticated','exec','rej:23514',$$SELECT public.mnt_sa_cancel_session(':CB', '00000000-0000-4000-8000-0000000a0035', 'x')$$),
  (25,'manager','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_delete_plan(':CB', '00000000-0000-4000-8000-0000000a0003', true)$$),
  (26,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_delete_plan(':CB', '00000000-0000-4000-8000-0000000a0002', true)->>'eligible')::boolean$$),
  (27,'propietario','-','-','count','rows:2',$$SELECT 1 FROM public.maintenance_plans WHERE id='00000000-0000-4000-8000-0000000a0002' UNION ALL SELECT 1 FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0033'$$),
  (28,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (SELECT r->'remove'->'empty_drafts'='["T2A-S4"]'::jsonb AND (r->>'eligible')::boolean AND NOT (r->>'deleted')::boolean FROM (SELECT public.mnt_sa_delete_plan(':CB', '00000000-0000-4000-8000-0000000a0003') r) z)$$),
  (29,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0034'$$),
  (30,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_delete_plan(':CB', '00000000-0000-4000-8000-0000000a0003', true)->>'deleted')::boolean$$),
  (31,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.maintenance_plans WHERE id='00000000-0000-4000-8000-0000000a0003' UNION ALL SELECT 1 FROM public.maintenance_sessions WHERE id='00000000-0000-4000-8000-0000000a0034'$$),
  (32,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_delete_plan(':CB', '00000000-0000-4000-8000-0000000a0001', true)->>'deleted')::boolean$$),
  (33,'manager','A','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0011', true)$$),
  (34,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0011', true)->>'deleted')::boolean$$),
  (35,'propietario','-','-','count','rows:0',$$SELECT 1 FROM public.assets WHERE id='00000000-0000-4000-8000-0000000a0011'$$),
  (36,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE (SELECT NOT (r->>'eligible')::boolean AND r->'blockers' ? 'tiene documentos adjuntos' FROM (SELECT public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0015', true) r) z)$$),
  (37,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0012', true)->>'eligible')::boolean$$),
  (38,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE NOT (public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0013', true)->>'eligible')::boolean$$),
  (39,'propietario','-','-','count','rows:3',$$SELECT 1 FROM public.assets WHERE id IN ('00000000-0000-4000-8000-0000000a0012','00000000-0000-4000-8000-0000000a0013','00000000-0000-4000-8000-0000000a0015')$$),
  (40,'propietario','-','-','exec','rej:42501',$$UPDATE public.documents SET deleted_at=now() WHERE id='00000000-0000-4000-8000-0000000a0051'$$),
  (41,'propietario','-','-','exec','rej:42501',$$DELETE FROM public.documents WHERE id='00000000-0000-4000-8000-0000000a0051'$$),
  (42,'propietario','-','-','exec','ok',$$UPDATE public.documents SET deleted_at=now() WHERE id='00000000-0000-4000-8000-0000000a0052'$$),
  (43,'propietario','-','-','exec','rej:42501',$$DELETE FROM public.incidents WHERE id='00000000-0000-4000-8000-0000000a0061'$$),
  (44,'admin','B','authenticated','count','rows:1',$$SELECT 1 WHERE public.mnt_sa_storage_protected('test-2a/evidencia.pdf') AND NOT public.mnt_sa_storage_protected('test-2a/manual.pdf')$$),
  (45,'admin','B','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_session_activity('00000000-0000-4000-8000-0000000a0033')$$),
  (46,'manager','A','authenticated','exec','ok',$$SELECT public.mnt_sa_close_session(':CB', '00000000-0000-4000-8000-0000000a0036', 'Técnico', NULL, 'sig')$$),
  (47,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.maintenance_plan_assets WHERE id='00000000-0000-4000-8000-0000000a0024' AND next_due_on='2026-02-10'$$),
  (48,'anon','-','anon','exec','rej:42501',$$SELECT public.mnt_sa_delete_asset(':CB', '00000000-0000-4000-8000-0000000a0014', true)$$),
  (50,'propietario','-','-','exec','ok',$$DELETE FROM public.company_members WHERE user_id='3b7de027-5b93-4336-a2a3-ececd12f7443' AND company_id=':CB'$$),
  (51,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_delete_draft_session(':CB', '00000000-0000-4000-8000-0000000a0033')$$),
  (52,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_cancel_session(':CB', '00000000-0000-4000-8000-0000000a0036', 'x')$$),
  (53,'admin otra org','A0','authenticated','exec','rej:42501',$$SELECT public.mnt_sa_unlink_plan_asset(':CB', '00000000-0000-4000-8000-0000000a0024', 'x')$$)
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
    results := results || format(E'\n%s %s (%s): esperado %s, obtenido %s', CASE WHEN v = r.expected THEN 'PASS' ELSE 'FAIL' END, r.n, r.actor, r.expected, v);
    IF v = r.expected THEN passed := passed + 1; ELSE fails := fails || format(' [%s %s: esperado %s, obtenido %s]', r.n, r.actor, r.expected, v); END IF;
  END LOOP;
  RAISE EXCEPTION 'MNT_2A RESULTADO %/% % %', passed, total, CASE WHEN fails = '' THEN '' ELSE ' FALLOS:' || fails END, results;
END
$run$;
