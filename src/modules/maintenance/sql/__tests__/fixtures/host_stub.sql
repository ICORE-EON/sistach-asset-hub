-- TEST-ONLY simulated host (NOT part of the package). Emulates the ICORE integration points:
-- Supabase-like roles and auth.uid(), memberships/permissions, sites and document versions.
\set ON_ERROR_STOP on
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $r$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
CREATE SCHEMA IF NOT EXISTS host_stub;
CREATE TABLE IF NOT EXISTS host_stub.members (org_id uuid, person uuid, name text, perms text[], PRIMARY KEY (org_id, person));
CREATE TABLE IF NOT EXISTS host_stub.sites (org_id uuid, id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS host_stub.doc_versions (org_id uuid, id uuid PRIMARY KEY, sha256 text);

CREATE OR REPLACE FUNCTION public.host_has_perm(p_org uuid, p_perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT p_perm = ANY (m.perms) OR 'mnt.admin' = ANY (m.perms)
                     FROM host_stub.members m WHERE m.org_id = p_org AND m.person = auth.uid()), false)
$$;
CREATE OR REPLACE FUNCTION public.host_person_ref() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
CREATE OR REPLACE FUNCTION public.host_person_snapshot(p uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('name', coalesce((SELECT name FROM host_stub.members WHERE person = p LIMIT 1), 'desconocido'),
                            'role', NULL, 'external', false, 'provider', NULL)
$$;
CREATE OR REPLACE FUNCTION public.host_site_in_org(p_org uuid, p_site uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM host_stub.sites WHERE org_id = p_org AND id = p_site)
$$;
CREATE OR REPLACE FUNCTION public.host_document_version_sha(p_org uuid, p_ref uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT sha256 FROM host_stub.doc_versions WHERE org_id = p_org AND id = p_ref
$$;
REVOKE ALL ON FUNCTION public.host_has_perm(uuid,text), public.host_person_snapshot(uuid),
  public.host_site_in_org(uuid,uuid), public.host_document_version_sha(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_has_perm(uuid,text), public.host_person_ref(), public.host_person_snapshot(uuid),
  public.host_site_in_org(uuid,uuid), public.host_document_version_sha(uuid,uuid) TO authenticated, service_role;
