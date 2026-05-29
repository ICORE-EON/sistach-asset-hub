-- Enable RLS on the partition just created
ALTER TABLE public.audit_logs_2026_08 ENABLE ROW LEVEL SECURITY;

-- Update partition-creation function to ALWAYS enable RLS on new partitions
CREATE OR REPLACE FUNCTION public.audit_logs_ensure_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_name TEXT;
  v_created INT := 0;
  i INT;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_start := date_trunc('month', CURRENT_DATE + (i || ' months')::interval)::date;
    v_end   := (v_start + INTERVAL '1 month')::date;
    v_name  := format('audit_logs_%s', to_char(v_start, 'YYYY_MM'));
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
        v_name, v_start, v_end
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_name);
      v_created := v_created + 1;
    END IF;
  END LOOP;
  RETURN v_created;
END;
$$;
