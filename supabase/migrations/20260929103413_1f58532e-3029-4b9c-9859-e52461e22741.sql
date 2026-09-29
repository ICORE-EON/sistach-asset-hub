REVOKE ALL ON public.mnt_mtr_equipment, public.mnt_mtr_control_plans, public.mnt_mtr_records, public.mnt_mtr_record_lines,
  public.mnt_mtr_unfit_decisions, public.mnt_mtr_impact_reviews, public.mnt_mtr_site_moves, public.mnt_mtr_status_history
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mnt_mtr_equipment, public.mnt_mtr_control_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mnt_mtr_records, public.mnt_mtr_record_lines TO authenticated;
GRANT SELECT ON public.mnt_mtr_unfit_decisions, public.mnt_mtr_impact_reviews, public.mnt_mtr_site_moves, public.mnt_mtr_status_history TO authenticated;
GRANT ALL ON public.mnt_mtr_equipment, public.mnt_mtr_control_plans, public.mnt_mtr_records, public.mnt_mtr_record_lines,
  public.mnt_mtr_unfit_decisions, public.mnt_mtr_impact_reviews, public.mnt_mtr_site_moves, public.mnt_mtr_status_history TO service_role;