
-- 1) Per-user read state for notification events
CREATE TABLE public.notification_reads (
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY nr_select ON public.notification_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY nr_insert ON public.notification_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY nr_delete ON public.notification_reads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_notification_reads_user ON public.notification_reads(user_id, read_at DESC);

-- 2) Triggers: incidents
CREATE OR REPLACE FUNCTION public.notify_incident_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_severity TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_severity := CASE NEW.severity
      WHEN 'critical' THEN 'critical'
      WHEN 'high' THEN 'warning'
      ELSE 'info'
    END;
    INSERT INTO public.notification_events(
      company_id, event_type, severity, subject, body,
      asset_id, incident_id, payload
    ) VALUES (
      NEW.company_id, 'incident.created', v_severity,
      'Nueva incidencia: ' || NEW.code || ' — ' || NEW.title,
      COALESCE(NEW.description, ''),
      NEW.asset_id, NEW.id,
      jsonb_build_object('code', NEW.code, 'severity', NEW.severity, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('closed','resolved') THEN
    INSERT INTO public.notification_events(
      company_id, event_type, severity, subject, body,
      asset_id, incident_id, payload
    ) VALUES (
      NEW.company_id,
      CASE WHEN NEW.status = 'resolved' THEN 'incident.resolved' ELSE 'incident.closed' END,
      'info',
      'Incidencia ' || NEW.code || ' ' ||
        CASE WHEN NEW.status='resolved' THEN 'resuelta' ELSE 'cerrada' END,
      COALESCE(NEW.resolution_notes, ''),
      NEW.asset_id, NEW.id,
      jsonb_build_object('code', NEW.code, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_incidents
AFTER INSERT OR UPDATE OF status ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.notify_incident_change();

-- 3) Triggers: maintenance sessions closed
CREATE OR REPLACE FUNCTION public.notify_session_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
    INSERT INTO public.notification_events(
      company_id, event_type, severity, subject, body,
      maintenance_session_id, payload
    ) VALUES (
      NEW.company_id, 'maintenance.closed', 'info',
      'Mantenimiento cerrado: ' || NEW.code,
      'Sesión cerrada por ' || COALESCE(NEW.signer_name, 'desconocido'),
      NEW.id,
      jsonb_build_object('code', NEW.code, 'closed_at', NEW.closed_at)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_sessions
AFTER UPDATE OF status ON public.maintenance_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_session_closed();

-- 4) Daily job: generate expiry notifications (documents, certificates, asset warranties)
CREATE OR REPLACE FUNCTION public.generate_expiry_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INTEGER := 0;
  v_today DATE := CURRENT_DATE;
  v_horizon DATE := CURRENT_DATE + INTERVAL '30 days';
BEGIN
  -- Documents expiring soon (skip duplicates in last 7 days)
  INSERT INTO public.notification_events(
    company_id, event_type, severity, subject, body, document_id, asset_id, payload
  )
  SELECT
    d.company_id,
    CASE WHEN d.expires_on < v_today THEN 'document.expired' ELSE 'document.expiring' END,
    CASE WHEN d.expires_on < v_today THEN 'critical'
         WHEN d.expires_on <= v_today + INTERVAL '7 days' THEN 'warning'
         ELSE 'info' END,
    CASE WHEN d.expires_on < v_today
         THEN 'Documento caducado: ' || d.title
         ELSE 'Documento por caducar: ' || d.title END,
    'Vence el ' || to_char(d.expires_on, 'YYYY-MM-DD'),
    d.id, d.asset_id,
    jsonb_build_object('category', d.category, 'expires_on', d.expires_on)
  FROM public.documents d
  WHERE d.deleted_at IS NULL
    AND d.expires_on IS NOT NULL
    AND d.expires_on <= v_horizon
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_events e
      WHERE e.document_id = d.id
        AND e.event_type IN ('document.expiring','document.expired')
        AND e.created_at > now() - INTERVAL '7 days'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Certificates expiring soon
  INSERT INTO public.notification_events(
    company_id, event_type, severity, subject, body, certificate_id, payload
  )
  SELECT
    c.company_id,
    CASE WHEN c.valid_until < v_today THEN 'certificate.expired' ELSE 'certificate.expiring' END,
    CASE WHEN c.valid_until < v_today THEN 'critical'
         WHEN c.valid_until <= v_today + INTERVAL '7 days' THEN 'warning'
         ELSE 'info' END,
    CASE WHEN c.valid_until < v_today
         THEN 'Certificado caducado: ' || c.title
         ELSE 'Certificado por caducar: ' || c.title END,
    'Válido hasta el ' || to_char(c.valid_until, 'YYYY-MM-DD'),
    c.id,
    jsonb_build_object('code', c.code, 'valid_until', c.valid_until)
  FROM public.certificates c
  WHERE c.deleted_at IS NULL
    AND c.valid_until IS NOT NULL
    AND c.valid_until <= v_horizon
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_events e
      WHERE e.certificate_id = c.id
        AND e.event_type IN ('certificate.expiring','certificate.expired')
        AND e.created_at > now() - INTERVAL '7 days'
    );

  -- Asset warranties expiring
  INSERT INTO public.notification_events(
    company_id, event_type, severity, subject, body, asset_id, payload
  )
  SELECT
    a.company_id,
    'asset.warranty_expiring', 'warning',
    'Garantía por vencer: ' || COALESCE(a.name, a.code),
    'La garantía vence el ' || to_char(a.warranty_until, 'YYYY-MM-DD'),
    a.id,
    jsonb_build_object('code', a.code, 'warranty_until', a.warranty_until)
  FROM public.assets a
  WHERE a.deleted_at IS NULL
    AND a.warranty_until IS NOT NULL
    AND a.warranty_until BETWEEN v_today AND v_horizon
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_events e
      WHERE e.asset_id = a.id
        AND e.event_type = 'asset.warranty_expiring'
        AND e.created_at > now() - INTERVAL '7 days'
    );

  RETURN v_count;
END;
$$;

-- 5) Schedule daily 7:00 UTC (≈ 08:00 Europe/Madrid invierno / 09:00 verano)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'generate-expiry-notifications',
  '0 7 * * *',
  $cron$ SELECT public.generate_expiry_notifications(); $cron$
);
