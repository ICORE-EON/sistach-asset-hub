-- Metrology add-on behaviour tests (synthetic ids, throwaway DB only). Requires tests.sql helpers (schema t).
\set ON_ERROR_STOP on
SET client_min_messages = notice;
INSERT INTO host_stub.members VALUES
 ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000c1','Metro A','{mnt.view,mnt.manage_assets,mnt.run,mnt.close}'),
 ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000c2','Lector A','{mnt.view}')
 ON CONFLICT DO NOTHING;
INSERT INTO host_stub.sites VALUES ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000005a1'),
 ('b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000005b1') ON CONFLICT DO NOTHING;
SELECT public.mnt_register_org('a0000000-0000-4000-8000-000000000001');
SELECT public.mnt_register_org('b0000000-0000-4000-8000-000000000001');
SET ROLE authenticated;
SELECT t.login('c0000000-0000-4000-8000-0000000000c1');
SELECT t.fails('mtr: site de otra org rechazado', $$INSERT INTO mnt_mtr_equipment(org_id,code,name,equipment_type,site_id) VALUES ('a0000000-0000-4000-8000-000000000001','X','x','calibre','c0000000-0000-4000-8000-0000000005b1')$$, '23514');
SELECT t.fails('mtr: alta en org ajena denegada por RLS', $$INSERT INTO mnt_mtr_equipment(org_id,code,name,equipment_type,site_id) VALUES ('b0000000-0000-4000-8000-000000000001','X','x','calibre','c0000000-0000-4000-8000-0000000005b1')$$, '42501');
INSERT INTO mnt_mtr_equipment(id,org_id,code,name,equipment_type,site_id) VALUES
 ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','MTR-1','Calibre','calibre','c0000000-0000-4000-8000-0000000005a1');
INSERT INTO mnt_mtr_control_plans(id,org_id,equipment_id,control_kind,method,frequency_unit,frequency_value) VALUES
 ('e0000000-0000-4000-8000-0000000000f1','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','verification','external','months',12);
SELECT t.fails('mtr: estado solo por operaciones', $$UPDATE mnt_mtr_equipment SET status='retired' WHERE code='MTR-1'$$, '42501');
INSERT INTO mnt_mtr_records(id,org_id,equipment_id,control_plan_id,kind,performed_on,result) VALUES
 ('e0000000-0000-4000-8000-0000000000d1','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-0000000000f1','verification',current_date,'fit');
INSERT INTO mnt_mtr_record_lines(org_id,record_id,position,label,reference_value,measured_value,tolerance) VALUES
 ('a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-0000000000d1',1,'10 mm',10,10.02,0.05);
SELECT t.fails('mtr: cliente no puede validar directamente', $$UPDATE mnt_mtr_records SET status='validated' WHERE id='e0000000-0000-4000-8000-0000000000d1'$$, '42501');
SELECT t.ok('mtr: validar Apto', (public.mnt_mtr_validate_record('e0000000-0000-4000-8000-0000000000d1')->>'result') = 'fit');
SELECT t.ok('mtr: próximo control calculado (12 meses)', (SELECT next_due_on FROM mnt_mtr_control_plans WHERE id='e0000000-0000-4000-8000-0000000000f1') = (current_date + interval '12 months')::date);
SELECT t.fails('mtr: registro validado inmutable', $$UPDATE mnt_mtr_records SET observations='x' WHERE id='e0000000-0000-4000-8000-0000000000d1'$$, '42501');
SELECT t.fails('mtr: líneas validadas inmutables', $$DELETE FROM mnt_mtr_record_lines WHERE record_id='e0000000-0000-4000-8000-0000000000d1'$$, '42501');
SELECT t.ok('mtr: rectificación v2 validada',
  (SELECT public.mnt_mtr_validate_record(public.mnt_mtr_rectify_record('e0000000-0000-4000-8000-0000000000d1','Error de transcripción'))->>'result') = 'fit');
SELECT t.ok('mtr: original sustituido', (SELECT status FROM mnt_mtr_records WHERE id='e0000000-0000-4000-8000-0000000000d1') = 'superseded');
-- unfit -> impact review -> decision
INSERT INTO mnt_mtr_records(id,org_id,equipment_id,control_plan_id,kind,performed_on,result) VALUES
 ('e0000000-0000-4000-8000-0000000000d3','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-0000000000f1','verification',current_date,'unfit');
SELECT t.ok('mtr: No apto bloquea equipo',
  (public.mnt_mtr_validate_record('e0000000-0000-4000-8000-0000000000d3')->>'equipment_status') = 'unfit');
SELECT t.ok('mtr: abre evaluación de impacto', (SELECT count(*) FROM mnt_mtr_impact_reviews WHERE status='pending') = 1);
SELECT t.fails('mtr: impacto exige acciones', $$SELECT public.mnt_mtr_close_impact((SELECT id FROM mnt_mtr_impact_reviews LIMIT 1),'impact','j',NULL,NULL,NULL,NULL,NULL,NULL,NULL)$$, '23514');
SELECT public.mnt_mtr_close_impact((SELECT id FROM mnt_mtr_impact_reviews LIMIT 1),'no_impact','Sin productos afectados',NULL,'2026',NULL,NULL,NULL,NULL,NULL);
SELECT t.ok('mtr: decisión reparar -> fuera de servicio', public.mnt_mtr_decide_unfit('e0000000-0000-4000-8000-0000000000d3','repair','x',NULL) = 'out_of_service');
SELECT t.fails('mtr: reactivar sin control Apto posterior', $$SELECT public.mnt_mtr_set_status('e0000000-0000-4000-8000-000000000001','operational','ok')$$, '55000');
SELECT t.fails('mtr: historial de estado inmutable', $$DELETE FROM mnt_mtr_status_history$$, NULL);
SELECT t.ok('mtr: historial y outbox registrados', (SELECT count(*) FROM mnt_mtr_status_history) >= 2);
-- isolation and permissions
SELECT t.login('c0000000-0000-4000-8000-0000000000c2');
SELECT t.fails('mtr: lector no puede mover site', $$SELECT public.mnt_mtr_move_site('e0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000005a1',NULL,NULL)$$, '42501');
SELECT t.login('b0000000-0000-4000-8000-0000000000b1');
SELECT t.ok('mtr: otra org no ve equipos ni registros', (SELECT count(*) FROM mnt_mtr_equipment) + (SELECT count(*) FROM mnt_mtr_records) = 0);
SELECT t.fails('mtr: otra org no valida registros ajenos', $$SELECT public.mnt_mtr_validate_record('e0000000-0000-4000-8000-0000000000d3')$$, '42501');
SELECT t.login(NULL);
SELECT t.ok('mtr: usuario sin sesión no ve nada', (SELECT count(*) FROM mnt_mtr_equipment) = 0);
RESET ROLE;
SET ROLE anon;
SELECT t.fails('mtr: anon sin acceso', $$SELECT 1 FROM mnt_mtr_equipment$$, '42501');
RESET ROLE;
-- rollback: a failing atomic op leaves nothing behind
SELECT t.ok('mtr: outbox recibe validaciones', (SELECT count(*) FROM mnt_outbox WHERE event_type='mnt.mtr.record_validated') = 3);
DO $$ BEGIN RAISE NOTICE 'MTR_TESTS_DONE'; END $$;
