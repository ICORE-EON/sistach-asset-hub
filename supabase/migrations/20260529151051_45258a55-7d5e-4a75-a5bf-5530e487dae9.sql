
-- =========================================================
-- CERTIFICATES (multi-asset)
-- =========================================================
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  issued_on DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  issuer_name TEXT,
  issuer_role TEXT,
  external_provider TEXT,
  external_cert_number TEXT,
  pdf_url TEXT,
  pdf_hash_sha256 TEXT,
  signature_image_url TEXT,
  signer_ip INET,
  signer_user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT certificates_company_code_unique UNIQUE (company_id, code),
  CONSTRAINT certificates_status_chk CHECK (status IN ('draft','issued','revoked','expired'))
);
CREATE INDEX idx_certificates_company ON public.certificates(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_certificates_valid_until ON public.certificates(company_id, valid_until);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificates_select ON public.certificates FOR SELECT TO authenticated
  USING (user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY certificates_insert ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (can_run_maintenance(company_id));
CREATE POLICY certificates_update ON public.certificates FOR UPDATE TO authenticated
  USING (can_manage_assets(company_id)) WITH CHECK (can_manage_assets(company_id));
CREATE POLICY certificates_delete ON public.certificates FOR DELETE TO authenticated
  USING (can_manage_company(company_id));

CREATE TRIGGER trg_certificates_updated_at BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Items: un certificado cubre varios activos/sesiones
CREATE TABLE public.certificate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  maintenance_session_id UUID REFERENCES public.maintenance_sessions(id) ON DELETE SET NULL,
  maintenance_item_id UUID REFERENCES public.maintenance_items(id) ON DELETE SET NULL,
  result TEXT NOT NULL DEFAULT 'ok',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT certificate_items_result_chk CHECK (result IN ('ok','conditional','failed','na'))
);
CREATE INDEX idx_cert_items_certificate ON public.certificate_items(certificate_id);
CREATE INDEX idx_cert_items_asset ON public.certificate_items(asset_id);
CREATE INDEX idx_cert_items_session ON public.certificate_items(maintenance_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_items TO authenticated;
GRANT ALL ON public.certificate_items TO service_role;
ALTER TABLE public.certificate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cert_items_select ON public.certificate_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.certificates c WHERE c.id = certificate_id AND user_has_membership(c.company_id)));
CREATE POLICY cert_items_modify ON public.certificate_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.certificates c WHERE c.id = certificate_id AND can_run_maintenance(c.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.certificates c WHERE c.id = certificate_id AND can_run_maintenance(c.company_id)));

-- =========================================================
-- DOCUMENTS (unified)
-- =========================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  file_hash_sha256 TEXT,
  -- Optional explicit FKs to attach the doc to one or more entities
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  vehicle_asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_session_id UUID REFERENCES public.maintenance_sessions(id) ON DELETE CASCADE,
  maintenance_item_id UUID REFERENCES public.maintenance_items(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  certificate_id UUID REFERENCES public.certificates(id) ON DELETE CASCADE,
  issued_on DATE,
  expires_on DATE,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT documents_category_chk CHECK (category IN (
    'asset_photo','asset_manual','asset_invoice','asset_warranty',
    'maintenance_pdf','maintenance_signature','maintenance_evidence',
    'incident_evidence','certificate_pdf','vehicle_doc','itv','insurance',
    'company_logo','import_file','other'
  ))
);
CREATE INDEX idx_documents_company ON public.documents(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_asset ON public.documents(asset_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_session ON public.documents(maintenance_session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_incident ON public.documents(incident_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_certificate ON public.documents(certificate_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_expires ON public.documents(company_id, expires_on) WHERE deleted_at IS NULL AND expires_on IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (user_has_membership(company_id) AND deleted_at IS NULL);
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (can_run_maintenance(company_id));
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (can_manage_assets(company_id)) WITH CHECK (can_manage_assets(company_id));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (can_manage_company(company_id));

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  subject TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional source refs
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  maintenance_session_id UUID REFERENCES public.maintenance_sessions(id) ON DELETE SET NULL,
  certificate_id UUID REFERENCES public.certificates(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notif_events_severity_chk CHECK (severity IN ('info','warning','critical')),
  CONSTRAINT notif_events_status_chk CHECK (status IN ('pending','processing','sent','failed','cancelled'))
);
CREATE INDEX idx_notif_events_company ON public.notification_events(company_id, status, scheduled_for);
CREATE INDEX idx_notif_events_type ON public.notification_events(event_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_events_select ON public.notification_events FOR SELECT TO authenticated
  USING (user_has_membership(company_id));
CREATE POLICY notif_events_insert ON public.notification_events FOR INSERT TO authenticated
  WITH CHECK (can_run_maintenance(company_id));
CREATE POLICY notif_events_update ON public.notification_events FOR UPDATE TO authenticated
  USING (can_manage_assets(company_id)) WITH CHECK (can_manage_assets(company_id));
CREATE POLICY notif_events_delete ON public.notification_events FOR DELETE TO authenticated
  USING (can_manage_company(company_id));

CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_user_id UUID,
  recipient_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  provider_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notif_deliv_channel_chk CHECK (channel IN ('email','sms','push','in_app','webhook')),
  CONSTRAINT notif_deliv_status_chk CHECK (status IN ('pending','sent','failed','bounced','opened'))
);
CREATE INDEX idx_notif_deliv_event ON public.notification_deliveries(event_id);
CREATE INDEX idx_notif_deliv_status ON public.notification_deliveries(status, created_at);
CREATE INDEX idx_notif_deliv_user ON public.notification_deliveries(recipient_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_deliv_select ON public.notification_deliveries FOR SELECT TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notification_events e WHERE e.id = event_id AND can_manage_assets(e.company_id))
  );
CREATE POLICY notif_deliv_modify ON public.notification_deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notification_events e WHERE e.id = event_id AND can_manage_company(e.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notification_events e WHERE e.id = event_id AND can_manage_company(e.company_id)));

CREATE TRIGGER trg_notif_deliv_updated_at BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- IMPORT SYSTEM (CSV/Excel)
-- =========================================================
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  file_name TEXT,
  file_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INT NOT NULL DEFAULT 0,
  ok_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_batches_company_code_unique UNIQUE (company_id, code),
  CONSTRAINT import_batches_source_chk CHECK (source_type IN ('csv','xlsx','json','manual')),
  CONSTRAINT import_batches_status_chk CHECK (status IN ('pending','validating','running','done','failed','cancelled')),
  CONSTRAINT import_batches_target_chk CHECK (target_entity IN (
    'assets','locations','vehicles','first_aid_kit_contents','maintenance_plans',
    'checklist_templates','company_members','incidents','documents'
  ))
);
CREATE INDEX idx_import_batches_company ON public.import_batches(company_id, created_at DESC);
CREATE INDEX idx_import_batches_status ON public.import_batches(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_batches_select ON public.import_batches FOR SELECT TO authenticated
  USING (user_has_membership(company_id));
CREATE POLICY import_batches_insert ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (can_manage_assets(company_id));
CREATE POLICY import_batches_update ON public.import_batches FOR UPDATE TO authenticated
  USING (can_manage_assets(company_id)) WITH CHECK (can_manage_assets(company_id));
CREATE POLICY import_batches_delete ON public.import_batches FOR DELETE TO authenticated
  USING (can_manage_company(company_id));

CREATE TRIGGER trg_import_batches_updated_at BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw JSONB NOT NULL,
  normalized JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  duplicate_of UUID,
  created_entity_id UUID,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_rows_status_chk CHECK (status IN ('pending','ok','error','duplicate','skipped')),
  CONSTRAINT import_rows_batch_row_unique UNIQUE (batch_id, row_number)
);
CREATE INDEX idx_import_rows_batch ON public.import_rows(batch_id);
CREATE INDEX idx_import_rows_status ON public.import_rows(batch_id, status);
CREATE INDEX idx_import_rows_dedupe ON public.import_rows(batch_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_rows_select ON public.import_rows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND user_has_membership(b.company_id)));
CREATE POLICY import_rows_modify ON public.import_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND can_manage_assets(b.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND can_manage_assets(b.company_id)));

CREATE TRIGGER trg_import_rows_updated_at BEFORE UPDATE ON public.import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_id UUID REFERENCES public.import_rows(id) ON DELETE CASCADE,
  error_code TEXT NOT NULL,
  field TEXT,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_errors_batch ON public.import_errors(batch_id);
CREATE INDEX idx_import_errors_row ON public.import_errors(row_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_errors TO authenticated;
GRANT ALL ON public.import_errors TO service_role;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_errors_select ON public.import_errors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND user_has_membership(b.company_id)));
CREATE POLICY import_errors_modify ON public.import_errors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND can_manage_assets(b.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND can_manage_assets(b.company_id)));
