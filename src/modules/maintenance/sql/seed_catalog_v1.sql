-- =============================================================================
-- Maintenance module · global catalogue seed, version 1
-- Minimal, versioned and idempotent. Global rows (org_id NULL, is_system) only.
-- Types are AVAILABLE but NOT enabled for any organisation (activation is an
-- explicit per-organisation row in mnt_org_asset_types). No fictitious data.
-- Stable ids (uuid5 over the code) so every installation shares the same ids.
-- Not seeded here (live in module code): default certificate template
-- (domain/certificate-templates/default.ts) and the 12 first-aid products
-- (domain/first-aid.ts).
-- =============================================================================
\set ON_ERROR_STOP on
BEGIN;
DO $v$ BEGIN
  IF to_regclass('public.mnt_asset_families') IS NULL THEN
    RAISE EXCEPTION 'MNT seed: run install_v1.sql first';
  END IF;
END $v$;

INSERT INTO public.mnt_asset_families AS t (id, org_id, code, name_i18n, color, sort_order, requires_certificate, is_system, catalog_version)
VALUES ('6ffca022-e23c-547f-bf1b-ce2499a8f2c1', NULL, 'pci', '{"ca": "Equips PCI", "en": "Fire protection", "es": "Equipos PCI"}'::jsonb, '#ef4444', 10, true, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, requires_certificate = EXCLUDED.requires_certificate, catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_families AS t (id, org_id, code, name_i18n, color, sort_order, requires_certificate, is_system, catalog_version)
VALUES ('9e42c4f2-185b-5cc7-8e6d-cdafab2aeb91', NULL, 'health', '{"ca": "Farmacioles i DEA", "en": "First aid and AED", "es": "Botiquines y DEA"}'::jsonb, '#10b981', 20, true, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, requires_certificate = EXCLUDED.requires_certificate, catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_families AS t (id, org_id, code, name_i18n, color, sort_order, requires_certificate, is_system, catalog_version)
VALUES ('63becc04-c69c-54e9-ba47-c005776e4cff', NULL, 'vehicles', '{"ca": "Vehicles", "en": "Vehicles", "es": "Vehículos"}'::jsonb, '#3b82f6', 30, false, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, requires_certificate = EXCLUDED.requires_certificate, catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_families AS t (id, org_id, code, name_i18n, color, sort_order, requires_certificate, is_system, catalog_version)
VALUES ('b29f66eb-17ae-5fdd-a6a9-dc34253154df', NULL, 'machinery', '{"ca": "Maquinària", "en": "Machinery", "es": "Maquinaria"}'::jsonb, '#f59e0b', 40, true, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, requires_certificate = EXCLUDED.requires_certificate, catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_families AS t (id, org_id, code, name_i18n, color, sort_order, requires_certificate, is_system, catalog_version)
VALUES ('1730a19e-5381-5981-8251-90f05e248000', NULL, 'other', '{"ca": "Altres", "en": "Other", "es": "Otros"}'::jsonb, '#64748b', 90, false, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order, requires_certificate = EXCLUDED.requires_certificate, catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('11b01d1c-5174-5dd8-8222-744aa0918bff', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'bie_25', '{"en": "Fire hose reel 25mm", "es": "BIE 25mm"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('a5a8421b-ba03-5181-8134-a26c80ce642d', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'bie_45', '{"en": "Fire hose reel 45mm", "es": "BIE 45mm"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('17619e9b-6eac-5464-b143-450eeeff6eca', NULL, '9e42c4f2-185b-5cc7-8e6d-cdafab2aeb91', 'defibrillator', '{"en": "Defibrillator (AED)", "es": "Desfibrilador (DEA)"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('50af4181-a3fc-5b56-8d1f-fe1bdea68fc9', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'emergency_light', '{"en": "Emergency light", "es": "Luz de emergencia"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('c5e05514-1c22-5ade-bcdb-0fef49af2ed5', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'extinguisher_co2', '{"en": "CO2 extinguisher", "es": "Extintor de CO2"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('c1118c0d-3fba-5aa9-998f-bb6c6733b397', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'extinguisher_powder', '{"en": "Powder extinguisher", "es": "Extintor de polvo"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('68db76e9-c48e-5b28-8fea-ab1a6d6174be', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'extinguisher_water', '{"en": "Water extinguisher", "es": "Extintor de agua"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('81755f5a-f067-53a1-aff3-57ba90e9902a', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'fire_alarm', '{"en": "Fire alarm panel", "es": "Central de alarma"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('37f759d8-8687-5080-8728-97cd691928d0', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'fire_door', '{"en": "Fire door", "es": "Puerta cortafuegos"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('bada6f37-4966-51a8-a311-7b2f2a5dc741', NULL, '9e42c4f2-185b-5cc7-8e6d-cdafab2aeb91', 'first_aid_kit', '{"en": "First aid kit", "es": "Botiquín"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('d937774d-12bc-583a-80f5-785ee131182b', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'signage', '{"en": "Signage", "es": "Señalización"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('8c33061e-f1ac-5181-b9cc-4017754cf86c', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'smoke_detector', '{"en": "Smoke detector", "es": "Detector de humos"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('86a8b210-7e64-50c0-8ec6-3436efab63b6', NULL, '6ffca022-e23c-547f-bf1b-ce2499a8f2c1', 'sprinkler', '{"en": "Sprinkler", "es": "Rociador"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_asset_types AS t (id, org_id, family_id, code, name_i18n, is_system, catalog_version)
VALUES ('7b85207d-8e81-5e12-bc36-5058af7f64e7', NULL, '63becc04-c69c-54e9-ba47-c005776e4cff', 'vehicle', '{"en": "Vehicle", "es": "Vehículo"}'::jsonb, true, 1)
ON CONFLICT (code) WHERE org_id IS NULL DO UPDATE SET name_i18n = EXCLUDED.name_i18n, family_id = EXCLUDED.family_id,
  catalog_version = EXCLUDED.catalog_version
  WHERE coalesce(t.catalog_version, 0) < EXCLUDED.catalog_version;
INSERT INTO public.mnt_catalog_versions(catalog, version) VALUES ('asset_catalog', 1)
ON CONFLICT (catalog) DO UPDATE SET version = EXCLUDED.version, applied_at = now()
  WHERE public.mnt_catalog_versions.version < EXCLUDED.version;
COMMIT;
