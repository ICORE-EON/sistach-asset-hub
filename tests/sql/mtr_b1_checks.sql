-- Metrología B1 — pruebas por perfil contra la base de la app. Todo dentro de una transacción con ROLLBACK:
-- Ejecución: pegar en el ejecutor SQL con privilegios de propietario. Resultado registrado: 90/91 antes del ajuste de permisos (caso 11: anon obtenía 0 filas en vez de rechazo); corregido en migración posterior.
-- no deja datos: el bloque termina SIEMPRE con RAISE EXCEPTION (reversión total) e informa del resultado.
-- Cada paso corre en su propia subtransacción (un fallo revierte solo ese paso).



DO $run$
DECLARE
  total int := 0; passed int := 0; fails text := '';
  r record; v text; c bigint; q text; k text; val text;
  UA constant text := '3b7de027-5b93-4336-a2a3-ececd12f7443';
  UB constant text := 'fbf169ac-47e9-4061-a3b2-c9e030e1f214';
  UN constant text := 'bacbcc08-a48e-4138-915d-6fa76c4c38bb';
  tok jsonb := jsonb_build_object(
    ':CA','e5b35c19-afd3-4675-9654-070e8a8ffc7d', ':CB','f80df1ea-1d54-43f1-9330-e35d277c91a6',
    ':SA2','00000000-0000-4000-8000-00000000a002', ':SA','00000000-0000-4000-8000-00000000a001',
    ':SB','00000000-0000-4000-8000-00000000b001', ':LA','be3b894e-1bd1-4b44-940c-ded3ee4909e8',
    ':EQ1','00000000-0000-4000-8000-0000000e0001', ':EQ2','00000000-0000-4000-8000-0000000e0002',
    ':EQB','00000000-0000-4000-8000-0000000e00b1',
    ':P1','00000000-0000-4000-8000-0000000c0001', ':P2','00000000-0000-4000-8000-0000000c0002',
    ':R1','00000000-0000-4000-8000-0000000d0001', ':R2','00000000-0000-4000-8000-0000000d0002',
    ':R3','00000000-0000-4000-8000-0000000d0003', ':UA', '3b7de027-5b93-4336-a2a3-ececd12f7443',
    ':EQ3','00000000-0000-4000-8000-0000000e0003', ':EQ4','00000000-0000-4000-8000-0000000e0004',
    ':P3','00000000-0000-4000-8000-0000000c0003', ':P4','00000000-0000-4000-8000-0000000c0004',
    ':R4','00000000-0000-4000-8000-0000000d0004', ':R5','00000000-0000-4000-8000-0000000d0005');
BEGIN
  INSERT INTO public.locations(id, company_id, code, name, kind) VALUES
   ('00000000-0000-4000-8000-00000000a001','e5b35c19-afd3-4675-9654-070e8a8ffc7d','MTRSA','Site A','site'),
   ('00000000-0000-4000-8000-00000000a002','e5b35c19-afd3-4675-9654-070e8a8ffc7d','MTRSA2','Site A2','site'),
   ('00000000-0000-4000-8000-00000000b001','f80df1ea-1d54-43f1-9330-e35d277c91a6','MTRSB','Site B','site');
  FOR r IN SELECT * FROM (VALUES
  -- Inventario y aislamiento
  (1,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_equipment(id,company_id,code,name,equipment_type,site_id) VALUES (':EQ1',':CA','MTR-1','Patrón','Bloque patrón',':SA')$$),
  (2,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_equipment(id,company_id,code,name,equipment_type,site_id) VALUES (':EQ2',':CA','MTR-2','Calibre','Calibre',':SA')$$),
  (3,'admin A','A','authenticated','exec','rej:23514',$$INSERT INTO public.mnt_mtr_equipment(company_id,code,name,equipment_type,site_id) VALUES (':CA','X1','x','x',':SB')$$),
  (4,'admin A','A','authenticated','exec','rej:23514',$$INSERT INTO public.mnt_mtr_equipment(company_id,code,name,equipment_type,site_id) VALUES (':CA','X2','x','x',':LA')$$),
  (5,'admin A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_mtr_equipment(company_id,code,name,equipment_type,site_id,status) VALUES (':CA','X3','x','x',':SA','unfit')$$),
  (6,'admin A','A','authenticated','exec','rej:23505',$$INSERT INTO public.mnt_mtr_equipment(company_id,code,name,equipment_type,site_id) VALUES (':CA','MTR-1','dup','x',':SA')$$),
  (7,'admin B','B','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_equipment(id,company_id,code,name,equipment_type,site_id) VALUES (':EQB',':CB','MTR-1','B','x',':SB')$$),
  (8,'admin B','B','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_mtr_equipment WHERE company_id=':CA'$$),
  (9,'admin B','B','authenticated','rows','rows:0',$$UPDATE public.mnt_mtr_equipment SET name='hack' WHERE company_id=':CA'$$),
  (10,'sin empresa','N','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_mtr_equipment$$),
  (11,'anon','-','anon','count','rej:42501',$$SELECT 1 FROM public.mnt_mtr_equipment$$),
  (12,'anon','-','anon','exec','rej:42501',$$SELECT public.mtr_validate_record(':R1')$$),
  -- Planes de control
  (13,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_control_plans(id,company_id,equipment_id,control_kind,method,frequency_unit,frequency_value,qualifies_as_reference) VALUES (':P1',':CA',':EQ1','calibration','external','years',5,true)$$),
  (14,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_control_plans(id,company_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES (':P2',':CA',':EQ2','verification','internal','months',12)$$),
  (15,'admin B','B','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_mtr_control_plans(company_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES (':CB',':EQ1','check','internal','days',7)$$),
  (16,'admin A','A','authenticated','exec','rej:23514',$$INSERT INTO public.mnt_mtr_control_plans(company_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES (':CA',':EQ1','check','internal','before_use',3)$$),
  -- Calibración externa del patrón
  (17,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,result,laboratory,certificate_number) VALUES (':R1',':CA',':EQ1',':P1','calibration',current_date-10,'fit','Lab','C-1')$$),
  (18,'admin A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_mtr_records(company_id,equipment_id,control_plan_id,kind,performed_on,result,status) VALUES (':CA',':EQ1',':P1','calibration',current_date,'fit','validated')$$),
  (19,'admin A','A','authenticated','exec','rej:23514',$$INSERT INTO public.mnt_mtr_records(company_id,equipment_id,control_plan_id,kind,performed_on) VALUES (':CA',':EQ1',':P1','check',current_date)$$),
  (20,'admin B','B','authenticated','exec','rej:42501',$$SELECT public.mtr_validate_record(':R1')$$),
  (21,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_validate_record(':R1')$$),
  (22,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_control_plans WHERE id=':P1' AND next_due_on=(current_date-10+interval '5 years')::date$$),
  (23,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_mtr_records SET observations='x' WHERE id=':R1'$$),
  (24,'propietario','-','-','exec','rej:42501',$$UPDATE public.mnt_mtr_records SET observations='x' WHERE id=':R1'$$),
  (25,'admin A','A','authenticated','rows','rows:0',$$DELETE FROM public.mnt_mtr_records WHERE id=':R1'$$),
  (26,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_validate_record(':R1')$$),
  (27,'admin A','A','authenticated','exec','rej:42501',$$SELECT public.mtr_reference_eligible(':CA',':EQ1',current_date)$$),
  (28,'propietario','-','-','count','rows:1',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date)$$),
  -- Elegibilidad del patrón
  (29,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date+365*6)$$),
  (30,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date-20)$$),
  (31,'propietario','-','-','exec','ok',$$UPDATE public.mnt_mtr_control_plans SET qualifies_as_reference=false WHERE id=':P1'$$),
  (32,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date)$$),
  (33,'propietario','-','-','exec','ok',$$UPDATE public.mnt_mtr_control_plans SET qualifies_as_reference=true WHERE id=':P1'$$),
  (34,'propietario','-','-','exec','ok',$$UPDATE public.mnt_mtr_equipment SET status='restricted', allowed_uses='solo lectura' WHERE id=':EQ1'$$),
  (35,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date)$$),
  (36,'propietario','-','-','exec','ok',$$UPDATE public.mnt_mtr_equipment SET status='operational', allowed_uses=NULL WHERE id=':EQ1'$$),
  (37,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CB',':EQ1',current_date)$$),
  -- Rollback atómico: una línea sin resultado aborta toda la validación
  (38,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,reference_equipment_id) VALUES (':R3',':CA',':EQ2',':P2','verification',current_date,':EQ1')$$),
  (39,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_record_lines(company_id,record_id,position,label,reference_value,measured_value,tolerance) VALUES (':CA',':R3',1,'10 mm',10,10.05,0.1),(':CA',':R3',2,'visual',NULL,NULL,NULL)$$),
  (40,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_validate_record(':R3')$$),
  (41,'propietario','-','-','count','rows:2',$$SELECT 1 FROM public.mnt_mtr_record_lines WHERE record_id=':R3' AND result IS NULL$$),
  (42,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_records WHERE id=':R3' AND status='draft'$$),
  (43,'admin A','A','authenticated','rows','rows:1',$$DELETE FROM public.mnt_mtr_records WHERE id=':R3'$$),
  -- Patrón de otra organización rechazado
  (44,'admin A','A','authenticated','exec','rej:23503',$$INSERT INTO public.mnt_mtr_records(company_id,equipment_id,control_plan_id,kind,performed_on,reference_equipment_id) VALUES (':CA',':EQ2',':P2','verification',current_date,':EQB')$$),
  -- Verificación interna No apto
  (45,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,reference_equipment_id) VALUES (':R2',':CA',':EQ2',':P2','verification',current_date,':EQ1')$$),
  (46,'admin A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_record_lines(company_id,record_id,position,label,reference_value,measured_value,tolerance) VALUES (':CA',':R2',1,'10 mm',10,10.5,0.2),(':CA',':R2',2,'20 mm',20,20.1,0.2)$$),
  (47,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_validate_record(':R2')$$),
  (48,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_records WHERE id=':R2' AND result='unfit'$$),
  (49,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_equipment WHERE id=':EQ2' AND status='unfit'$$),
  (50,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2' AND status='pending'$$),
  (51,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_status_history WHERE equipment_id=':EQ2' AND to_status='unfit'$$),
  (52,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_mtr_record_lines SET measured_value=10 WHERE record_id=':R2'$$),
  (53,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_mtr_equipment SET status='operational' WHERE id=':EQ2'$$),
  (54,'admin B','B','authenticated','count','rows:0',$$SELECT 1 FROM public.mnt_mtr_impact_reviews UNION ALL SELECT 1 FROM public.mnt_mtr_records WHERE company_id=':CA'$$),
  -- Decisión No apto: restricted
  (55,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_decide_unfit(':R2','restrict','uso limitado',NULL)$$),
  (56,'admin A','A','authenticated','exec','rej:22023',$$SELECT public.mtr_decide_unfit(':R2','ignore',NULL,NULL)$$),
  (57,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_decide_unfit(':R2','restrict','desviación en 10 mm','solo medidas > 15 mm')$$),
  (58,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_equipment WHERE id=':EQ2' AND status='restricted' AND allowed_uses IS NOT NULL$$),
  (59,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_decide_unfit(':R2','retire',NULL,NULL)$$),
  (60,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_set_status(':EQ2','operational','manual')$$),
  (61,'propietario','-','-','exec','rej:42501',$$UPDATE public.mnt_mtr_unfit_decisions SET notes='x'$$),
  (62,'propietario','-','-','exec','rej:42501',$$DELETE FROM public.mnt_mtr_status_history$$),
  -- Cierre de evaluación de impacto
  (63,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_close_impact((SELECT id FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2'),'impact','mediciones afectadas',NULL,'último año',current_date,NULL,NULL,NULL,NULL)$$),
  (64,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_close_impact((SELECT id FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2'),'no_impact',' ',NULL,NULL,current_date,NULL,NULL,NULL,NULL)$$),
  (65,'admin B','B','authenticated','exec','rej:42501',$$SELECT public.mtr_close_impact((SELECT id FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2' LIMIT 1),'no_impact','x',NULL,NULL,current_date,NULL,NULL,NULL,NULL)$$),
  (66,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_close_impact((SELECT id FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2'),'impact','mediciones afectadas','Repetir mediciones de lote 12','último año',current_date,'nc','NC-7',NULL,NULL)$$),
  (67,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_close_impact((SELECT id FROM public.mnt_mtr_impact_reviews WHERE record_id=':R2'),'no_impact','x',NULL,NULL,current_date,NULL,NULL,NULL,NULL)$$),
  (68,'propietario','-','-','exec','rej:42501',$$UPDATE public.mnt_mtr_impact_reviews SET justification='x' WHERE record_id=':R2'$$),
  -- Rectificación trazable
  (69,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_rectify_record(':R1','')$$),
  (70,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_rectify_record(':R1','Nº de certificado erróneo')$$),
  (71,'admin A','A','authenticated','exec','ok',$$UPDATE public.mnt_mtr_records SET certificate_number='C-1b' WHERE supersedes_id=':R1'$$),
  (72,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_validate_record((SELECT id FROM public.mnt_mtr_records WHERE supersedes_id=':R1'))$$),
  (73,'propietario','-','-','count','rows:2',$$SELECT 1 FROM public.mnt_mtr_records WHERE (id=':R1' AND status='superseded') OR (supersedes_id=':R1' AND status='validated' AND version=2)$$),
  (74,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_rectify_record(':R1','otra vez')$$),
  -- Traslados de site
  (75,'admin A','A','authenticated','exec','rej:42501',$$UPDATE public.mnt_mtr_equipment SET site_id=':SA2' WHERE id=':EQ1'$$),
  (76,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_move_site(':EQ1',':SA2','Laboratorio 2','traslado')$$),
  (77,'admin A','A','authenticated','exec','rej:23514',$$SELECT public.mtr_move_site(':EQ1',':SB',NULL,NULL)$$),
  (78,'propietario','-','-','count','rows:1',$$SELECT 1 FROM public.mnt_mtr_site_moves WHERE equipment_id=':EQ1' AND from_site_id=':SA' AND to_site_id=':SA2'$$),
  -- Transiciones manuales y retirada
  (79,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_set_status(':EQ2','out_of_service','revisión')$$),
  (80,'admin A','A','authenticated','exec','ok',$$SELECT public.mtr_set_status(':EQ2','retired','baja')$$),
   (81,'admin A','A','authenticated','exec','rej:55000',$$SELECT public.mtr_set_status(':EQ2','operational','reactivar')$$),
   -- Reactivación explícita: permitida si el último control validado fue Apto (con motivo y permiso)
   (82,'admin A','A','authenticated','exec','ok',$$DO $d$ BEGIN
     INSERT INTO public.mnt_mtr_equipment(id,company_id,code,name,equipment_type,site_id) VALUES (':EQ3',':CA','MTR-92','Eq92','Calibre',':SA');
     INSERT INTO public.mnt_mtr_control_plans(id,company_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES (':P3',':CA',':EQ3','calibration','external','years',1);
     INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,result,laboratory,certificate_number) VALUES (':R4',':CA',':EQ3',':P3','calibration',current_date,'fit','Lab','C-92');
     PERFORM public.mtr_validate_record(':R4');
     PERFORM public.mtr_set_status(':EQ3','out_of_service','revisión');
     PERFORM public.mtr_set_status(':EQ3','operational','fin de revisión');
   END $d$;$$),
   -- Reactivación rechazada: el último control validado fue No apto
   (83,'admin A','A','authenticated','exec','rej:55000',$$DO $d$ BEGIN
     INSERT INTO public.mnt_mtr_equipment(id,company_id,code,name,equipment_type,site_id) VALUES (':EQ4',':CA','MTR-93','Eq93','Calibre',':SA');
     INSERT INTO public.mnt_mtr_control_plans(id,company_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES (':P4',':CA',':EQ4','calibration','external','years',1);
     INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,result,laboratory,certificate_number) VALUES (':R5',':CA',':EQ4',':P4','calibration',current_date,'unfit','Lab','C-93');
     PERFORM public.mtr_validate_record(':R5');
     PERFORM public.mtr_set_status(':EQ4','operational','reactivar');
   END $d$;$$),
   -- Perfil empleado: puede registrar borradores, no validar ni gestionar inventario
  (84,'@employee','-','-','exec','ok',$$UPDATE public.company_members SET role='employee' WHERE user_id=':UA' AND company_id=':CA'$$),
  (85,'empleado A','A','authenticated','exec','ok',$$INSERT INTO public.mnt_mtr_records(id,company_id,equipment_id,control_plan_id,kind,performed_on,result,laboratory,certificate_number) VALUES (':R3',':CA',':EQ1',':P1','calibration',current_date,'fit','Lab','C-2')$$),
  (86,'empleado A','A','authenticated','exec','rej:42501',$$SELECT public.mtr_validate_record(':R3')$$),
  (87,'empleado A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_mtr_equipment(company_id,code,name,equipment_type,site_id) VALUES (':CA','X9','x','x',':SA')$$),
  (88,'empleado A','A','authenticated','exec','rej:42501',$$SELECT public.mtr_move_site(':EQ1',':SA',NULL,NULL)$$),
  (89,'@auditor','-','-','exec','ok',$$UPDATE public.company_members SET role='auditor' WHERE user_id=':UA' AND company_id=':CA'$$),
  (90,'auditor A','A','authenticated','count','rows:3',$$SELECT 1 FROM public.mnt_mtr_equipment$$),
  (91,'auditor A','A','authenticated','exec','rej:42501',$$INSERT INTO public.mnt_mtr_records(company_id,equipment_id,control_plan_id,kind,performed_on) VALUES (':CA',':EQ1',':P1','calibration',current_date)$$),
  -- Impacto pendiente bloquea el patrón
  (92,'propietario','-','-','exec','ok',$$INSERT INTO public.mnt_mtr_impact_reviews(company_id,equipment_id,record_id) VALUES (':CA',':EQ1',':R1')$$),
   (93,'propietario','-','-','count','rows:0',$$SELECT 1 WHERE public.mtr_reference_eligible(':CA',':EQ1',current_date)$$),
   ) t(n, actor, who, role, kind, expected, sql) ORDER BY n
  LOOP
    q := r.sql;
    -- tokens más largos primero para evitar reemplazos parciales (:SA2 antes de :SA)
    FOR k, val IN SELECT key, value FROM jsonb_each_text(tok) ORDER BY length(key) DESC LOOP
      q := replace(q, k, val);
    END LOOP;
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
    total := total + 1;
    IF v = r.expected THEN passed := passed + 1; ELSE fails := fails || format(' [%s %s: esperado %s, obtenido %s]', r.n, r.actor, r.expected, v); END IF;
  END LOOP;
  -- Aborta siempre: nada de lo anterior queda en la base.
  RAISE EXCEPTION 'MTR_B1 RESULTADO %/% %', passed, total, CASE WHEN fails = '' THEN '' ELSE ' FALLOS:' || fails END;
END
$run$;

