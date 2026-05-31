CREATE OR REPLACE FUNCTION public.incidents_record_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.incident_status_history(
      incident_id, from_status, to_status, changed_by, note
    ) VALUES (
      NEW.id, NULL, NEW.status, auth.uid(), 'Incident created'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.incident_status_history(
      incident_id, from_status, to_status, changed_by, note
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(), NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;