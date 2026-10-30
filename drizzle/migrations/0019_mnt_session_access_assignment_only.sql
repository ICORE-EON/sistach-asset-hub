-- Run-only operators (employee) see and execute ONLY sessions with an active explicit assignment.
-- Being technician or creator grants nothing by itself. close/admin and read-only roles keep company visibility.
CREATE OR REPLACE FUNCTION public.mnt_sa_session_visible(p_company uuid, p_session uuid, p_technician uuid, p_created_by uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.user_has_membership(p_company) AND (
    coalesce(public.user_role_in(p_company)::text, '') <> 'employee'
    OR EXISTS (SELECT 1 FROM public.mnt_session_assignees a
                WHERE a.session_id = p_session AND a.company_id = p_company AND a.user_id = auth.uid() AND a.revoked_at IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_can_execute_session(p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.maintenance_sessions s
     WHERE s.id = p_session AND public.can_run_maintenance(s.company_id)
       AND (public.can_close_session(s.company_id)
            OR EXISTS (SELECT 1 FROM public.mnt_session_assignees a
                        WHERE a.session_id = s.id AND a.company_id = s.company_id AND a.user_id = auth.uid() AND a.revoked_at IS NULL)));
$$;