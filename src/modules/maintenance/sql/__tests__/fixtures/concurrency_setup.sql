\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a1"}', false);
SELECT public.mnt_create_session('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000e0003', 'a0000000-0000-4000-8000-000000009101') AS s3 \gset
UPDATE mnt_session_items SET result = 'ok' WHERE session_id = :'s3';
\echo :s3
