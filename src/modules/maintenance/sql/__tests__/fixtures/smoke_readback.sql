\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT t.login('c0000000-0000-4000-8000-0000000000c1');
SELECT t.ok('smoke: persistencia tras COMMIT en conexión nueva', (SELECT count(*) FROM mnt_mtr_equipment WHERE id IN ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002') AND parent_asset_id='e0000000-0000-4000-8000-0000000000a2' AND asset_id IS NULL)=2);
SELECT t.login('b0000000-0000-4000-8000-0000000000b1');
SELECT t.ok('smoke: org B no lee fixture de A', (SELECT count(*) FROM mnt_mtr_equipment WHERE id IN ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002'))=0);
SELECT t.fails('smoke: org B no asocia instrumentos de A', $$SELECT mnt_mtr_associate_equipment('a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-0000000000a2',ARRAY['f0000000-0000-4000-8000-000000000001']::uuid[])$$,'42501');
RESET ROLE;
-- Only empty technical equipment in the throwaway cluster; never business data.
DELETE FROM mnt_mtr_equipment WHERE id IN ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002');
SELECT t.ok('smoke: fixture eliminada', (SELECT count(*) FROM mnt_mtr_equipment WHERE code LIKE 'EPHEMERAL-HANDOFF-%')=0);