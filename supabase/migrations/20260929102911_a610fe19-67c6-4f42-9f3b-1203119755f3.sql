REVOKE EXECUTE ON FUNCTION public.mtr_log_status(uuid,uuid,text,text,text,uuid,text), public.mtr_snapshot(),
  public.mtr_reference_eligible(uuid,uuid,date) FROM authenticated, anon, PUBLIC;