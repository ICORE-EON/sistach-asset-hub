
-- MIGRATION 02: Locations, Asset Types, Assets, Vehicles, Storage

-- ASSET TYPES
CREATE TABLE public.asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL CHECK (category IN (
    'extinguisher','bie','emergency_light','signage','fire_door',
    'detector','alarm','sprinkler','vehicle','first_aid_kit',
    'defibrillator','other'
  )),
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asset_types_scope_chk CHECK (
    (is_system = true AND company_id IS NULL) OR
    (is_system = false AND company_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX asset_types_global_code_uk
  ON public.asset_types(code) WHERE company_id IS NULL;
CREATE UNIQUE INDEX asset_types_company_code_uk
  ON public.asset_types(company_id, code) WHERE company_id IS NOT NULL;
CREATE INDEX asset_types_company_idx ON public.asset_types(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_types TO authenticated;
GRANT ALL ON public.asset_types TO service_role;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_types_select ON public.asset_types FOR SELECT TO authenticated
  USING (is_system = true OR public.user_has_membership(company_id));
CREATE POLICY asset_types_insert ON public.asset_types FOR INSERT TO authenticated
  WITH CHECK (is_system = false AND public.can_manage_assets(company_id));
CREATE POLICY asset_types_update ON public.asset_types FOR UPDATE TO authenticated
  USING (is_system = false AND public.can_manage_assets(company_id))
  WITH CHECK (is_system = false AND public.can_manage_assets(company_id));
CREATE POLICY asset_types_delete ON public.asset_types FOR DELETE TO authenticated
  USING (is_system = false AND public.can_manage_assets(company_id));

CREATE TRIGGER asset_types_updated_at BEFORE UPDATE ON public.asset_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LOCATIONS
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_location_id UUID NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'area'
    CHECK (kind IN ('site','building','floor','zone','area','room','other')),
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX locations_company_code_uk
  ON public.locations(company_id, code) WHERE deleted_at IS NULL;
CREATE INDEX locations_company_idx ON public.locations(company_id);
CREATE INDEX locations_parent_idx ON public.locations(parent_location_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY locations_insert ON public.locations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY locations_update ON public.locations FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id))
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY locations_delete ON public.locations FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ASSETS
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_type_id UUID NOT NULL REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  location_id UUID NULL REFERENCES public.locations(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  manufacture_date DATE,
  install_date DATE,
  warranty_until DATE,
  retire_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','out_of_service','retired','lost','reserved')),
  qr_token TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX assets_company_code_uk
  ON public.assets(company_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX assets_qr_token_uk ON public.assets(qr_token);
CREATE INDEX assets_company_idx ON public.assets(company_id);
CREATE INDEX assets_location_idx ON public.assets(location_id);
CREATE INDEX assets_type_idx ON public.assets(asset_type_id);
CREATE INDEX assets_status_idx ON public.assets(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX assets_serial_idx ON public.assets(company_id, serial_number)
  WHERE serial_number IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select ON public.assets FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY assets_insert ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY assets_update ON public.assets FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id))
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY assets_delete ON public.assets FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assets_set_qr_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
    NEW.qr_token := encode(extensions.gen_random_bytes(20), 'hex');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assets_qr_token_bi BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.assets_set_qr_token();

-- VEHICLES
CREATE TABLE public.vehicles (
  asset_id UUID PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  license_plate TEXT NOT NULL,
  vin TEXT,
  brand TEXT,
  vehicle_model TEXT,
  color TEXT,
  fuel_type TEXT,
  itv_expires_on DATE,
  insurance_expires_on DATE,
  current_km INTEGER,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_company_plate_uk
  ON public.vehicles(company_id, lower(license_plate));
CREATE INDEX vehicles_company_idx ON public.vehicles(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id));
CREATE POLICY vehicles_insert ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY vehicles_update ON public.vehicles FOR UPDATE TO authenticated
  USING (public.can_manage_assets(company_id))
  WITH CHECK (public.can_manage_assets(company_id));
CREATE POLICY vehicles_delete ON public.vehicles FOR DELETE TO authenticated
  USING (public.can_manage_company(company_id));

CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.vehicles_sync_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE v_company UUID;
BEGIN
  SELECT company_id INTO v_company FROM public.assets WHERE id = NEW.asset_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'vehicles.asset_id % not found', NEW.asset_id;
  END IF;
  NEW.company_id := v_company;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vehicles_sync_company_biud
  BEFORE INSERT OR UPDATE OF asset_id ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.vehicles_sync_company();

-- VEHICLE MOUNTS
CREATE TABLE public.vehicle_mounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_asset_id UUID NOT NULL REFERENCES public.vehicles(asset_id) ON DELETE CASCADE,
  mounted_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  position TEXT,
  mounted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_mounts_no_self CHECK (vehicle_asset_id <> mounted_asset_id)
);
CREATE UNIQUE INDEX vehicle_mounts_active_uk
  ON public.vehicle_mounts(mounted_asset_id) WHERE removed_at IS NULL;
CREATE INDEX vehicle_mounts_vehicle_idx ON public.vehicle_mounts(vehicle_asset_id);
CREATE INDEX vehicle_mounts_mounted_idx ON public.vehicle_mounts(mounted_asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_mounts TO authenticated;
GRANT ALL ON public.vehicle_mounts TO service_role;
ALTER TABLE public.vehicle_mounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_mounts_select ON public.vehicle_mounts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a
    WHERE a.id = vehicle_mounts.vehicle_asset_id
      AND public.user_has_membership(a.company_id)));
CREATE POLICY vehicle_mounts_insert ON public.vehicle_mounts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = vehicle_mounts.vehicle_asset_id
      AND public.can_manage_assets(a.company_id))
    AND EXISTS (SELECT 1 FROM public.assets a2 WHERE a2.id = vehicle_mounts.mounted_asset_id
      AND public.can_manage_assets(a2.company_id))
  );
CREATE POLICY vehicle_mounts_update ON public.vehicle_mounts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = vehicle_mounts.vehicle_asset_id
    AND public.can_manage_assets(a.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = vehicle_mounts.vehicle_asset_id
    AND public.can_manage_assets(a.company_id)));
CREATE POLICY vehicle_mounts_delete ON public.vehicle_mounts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = vehicle_mounts.vehicle_asset_id
    AND public.can_manage_company(a.company_id)));

CREATE TRIGGER vehicle_mounts_updated_at BEFORE UPDATE ON public.vehicle_mounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FIRST AID KIT CONTENTS
CREATE TABLE public.first_aid_kit_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  product_code TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT,
  batch_code TEXT,
  expires_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fak_contents_kit_idx ON public.first_aid_kit_contents(kit_asset_id);
CREATE INDEX fak_contents_expiry_idx ON public.first_aid_kit_contents(expires_on)
  WHERE expires_on IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.first_aid_kit_contents TO authenticated;
GRANT ALL ON public.first_aid_kit_contents TO service_role;
ALTER TABLE public.first_aid_kit_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY fak_contents_select ON public.first_aid_kit_contents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = first_aid_kit_contents.kit_asset_id
    AND public.user_has_membership(a.company_id)));
CREATE POLICY fak_contents_insert ON public.first_aid_kit_contents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = first_aid_kit_contents.kit_asset_id
    AND public.can_manage_assets(a.company_id)));
CREATE POLICY fak_contents_update ON public.first_aid_kit_contents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = first_aid_kit_contents.kit_asset_id
    AND public.can_manage_assets(a.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = first_aid_kit_contents.kit_asset_id
    AND public.can_manage_assets(a.company_id)));
CREATE POLICY fak_contents_delete ON public.first_aid_kit_contents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = first_aid_kit_contents.kit_asset_id
    AND public.can_manage_assets(a.company_id)));

CREATE TRIGGER fak_contents_updated_at BEFORE UPDATE ON public.first_aid_kit_contents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES
  ('asset-photos','asset-photos', false),
  ('documents','documents', false),
  ('signed-certificates','signed-certificates', false),
  ('signatures','signatures', false),
  ('company-logos','company-logos', false),
  ('avatars','avatars', false),
  ('import-files','import-files', false)
ON CONFLICT (id) DO NOTHING;

-- asset-photos
CREATE POLICY "asset-photos read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-photos' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));
CREATE POLICY "asset-photos write managers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-photos' AND public.can_manage_assets(((storage.foldername(name))[1])::uuid));
CREATE POLICY "asset-photos update managers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-photos' AND public.can_manage_assets(((storage.foldername(name))[1])::uuid));
CREATE POLICY "asset-photos delete managers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-photos' AND public.can_manage_assets(((storage.foldername(name))[1])::uuid));

-- documents
CREATE POLICY "documents read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));
CREATE POLICY "documents write managers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.can_manage_assets(((storage.foldername(name))[1])::uuid));
CREATE POLICY "documents update managers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND public.can_manage_assets(((storage.foldername(name))[1])::uuid));
CREATE POLICY "documents delete admins" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));

-- signed-certificates (immutable)
CREATE POLICY "signed-certificates read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signed-certificates' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));
CREATE POLICY "signed-certificates write managers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signed-certificates' AND public.can_close_session(((storage.foldername(name))[1])::uuid));

-- signatures (immutable)
CREATE POLICY "signatures read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));
CREATE POLICY "signatures write members" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));

-- company-logos
CREATE POLICY "company-logos read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos' AND public.user_has_membership(((storage.foldername(name))[1])::uuid));
CREATE POLICY "company-logos write admins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "company-logos update admins" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "company-logos delete admins" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));

-- avatars (per-user folder)
CREATE POLICY "avatars read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- import-files
CREATE POLICY "import-files read admins" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'import-files' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "import-files write admins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'import-files' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "import-files delete admins" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'import-files' AND public.can_manage_company(((storage.foldername(name))[1])::uuid));

-- SEED system asset types
INSERT INTO public.asset_types (code, category, is_system, name_i18n) VALUES
  ('extinguisher_powder','extinguisher', true, '{"es":"Extintor de polvo","en":"Powder extinguisher"}'),
  ('extinguisher_co2','extinguisher', true, '{"es":"Extintor de CO2","en":"CO2 extinguisher"}'),
  ('extinguisher_water','extinguisher', true, '{"es":"Extintor de agua","en":"Water extinguisher"}'),
  ('bie_25','bie', true, '{"es":"BIE 25mm","en":"Fire hose reel 25mm"}'),
  ('bie_45','bie', true, '{"es":"BIE 45mm","en":"Fire hose reel 45mm"}'),
  ('emergency_light','emergency_light', true, '{"es":"Luz de emergencia","en":"Emergency light"}'),
  ('signage','signage', true, '{"es":"Señalización","en":"Signage"}'),
  ('fire_door','fire_door', true, '{"es":"Puerta cortafuegos","en":"Fire door"}'),
  ('smoke_detector','detector', true, '{"es":"Detector de humos","en":"Smoke detector"}'),
  ('fire_alarm','alarm', true, '{"es":"Central de alarma","en":"Fire alarm panel"}'),
  ('sprinkler','sprinkler', true, '{"es":"Rociador","en":"Sprinkler"}'),
  ('vehicle','vehicle', true, '{"es":"Vehículo","en":"Vehicle"}'),
  ('first_aid_kit','first_aid_kit', true, '{"es":"Botiquín","en":"First aid kit"}'),
  ('defibrillator','defibrillator', true, '{"es":"Desfibrilador (DEA)","en":"Defibrillator (AED)"}')
ON CONFLICT DO NOTHING;
