-- Technical fixture ONLY in run.sh's disposable cluster. Cross-connection persistence,
-- authenticated create/read, N:1 and tenant isolation; rollback restores fixture.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE authenticated;
SELECT t.login('c0000000-0000-4000-8000-0000000000c1');
INSERT INTO mnt_mtr_equipment(id,org_id,code,name,equipment_type,site_id) VALUES
 ('f0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','EPHEMERAL-HANDOFF-1','Sonda efímera','sonda','c0000000-0000-4000-8000-0000000005a1'),
 ('f0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','EPHEMERAL-HANDOFF-2','Instrumento efímero','calibre','c0000000-0000-4000-8000-0000000005a1');
SELECT t.ok('smoke: creación/lectura autenticada', (SELECT count(*) FROM mnt_mtr_equipment WHERE id IN ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002'))=2);
SELECT t.ok('smoke: asociación N:1 por RPC', mnt_mtr_associate_equipment('a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-0000000000a2',ARRAY['f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002']::uuid[])=2);
COMMIT;
-- run.sh executes smoke_readback.sql in a NEW psql connection, then disposes the cluster.