-- Operarios (rol employee = solo mnt.run) ven únicamente sesiones asignadas, propias como técnico o creadas por ellos.
-- Responsables (close/admin) y perfiles de solo lectura conservan la visibilidad de empresa.
ALTER TABLE public.maintenance_sessions ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.mnt_sa_session_visible(p_company uuid, p_session uuid, p_technician uuid, p_created_by uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.user_has_membership(p_company) AND (
    coalesce(public.user_role_in(p_company)::text, '') <> 'employee'
    OR p_technician = auth.uid() OR p_created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.mnt_session_assignees a
                WHERE a.session_id = p_session AND a.user_id = auth.uid() AND a.revoked_at IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_can_see_session(p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.maintenance_sessions s
                  WHERE s.id = p_session AND public.mnt_sa_session_visible(s.company_id, s.id, s.technician_id, s.created_by));
$$;

CREATE OR REPLACE FUNCTION public.mnt_sa_can_see_item(p_item uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.maintenance_items i WHERE i.id = p_item AND public.mnt_sa_can_see_session(i.session_id));
$$;

-- A certificate tied to sessions is visible only if every linked session is visible.
CREATE OR REPLACE FUNCTION public.mnt_sa_can_see_certificate(p_cert uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.certificate_items ci
                      WHERE ci.certificate_id = p_cert AND ci.maintenance_session_id IS NOT NULL
                        AND NOT public.mnt_sa_can_see_session(ci.maintenance_session_id));
$$;

REVOKE ALL ON FUNCTION public.mnt_sa_session_visible(uuid, uuid, uuid, uuid), public.mnt_sa_can_see_session(uuid),
  public.mnt_sa_can_see_item(uuid), public.mnt_sa_can_see_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnt_sa_session_visible(uuid, uuid, uuid, uuid), public.mnt_sa_can_see_session(uuid),
  public.mnt_sa_can_see_item(uuid), public.mnt_sa_can_see_certificate(uuid) TO authenticated;

DROP POLICY IF EXISTS ms_select ON public.maintenance_sessions;
CREATE POLICY ms_select ON public.maintenance_sessions FOR SELECT TO authenticated
  USING (public.mnt_sa_session_visible(company_id, id, technician_id, created_by));
DROP POLICY IF EXISTS ms_update ON public.maintenance_sessions;
CREATE POLICY ms_update ON public.maintenance_sessions FOR UPDATE TO authenticated
  USING (public.can_run_maintenance(company_id) AND public.mnt_sa_session_visible(company_id, id, technician_id, created_by))
  WITH CHECK (public.can_run_maintenance(company_id));

DROP POLICY IF EXISTS mi_select ON public.maintenance_items;
CREATE POLICY mi_select ON public.maintenance_items FOR SELECT TO authenticated USING (public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS cr_select ON public.checklist_responses;
CREATE POLICY cr_select ON public.checklist_responses FOR SELECT TO authenticated USING (public.mnt_sa_can_see_item(maintenance_item_id));
DROP POLICY IF EXISTS srl_select ON public.session_reopen_log;
CREATE POLICY srl_select ON public.session_reopen_log FOR SELECT TO authenticated USING (public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS mse_select ON public.mnt_session_entries;
CREATE POLICY mse_select ON public.mnt_session_entries FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS mnt_sa_assignees_select ON public.mnt_session_assignees;
CREATE POLICY mnt_sa_assignees_select ON public.mnt_session_assignees FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS mnt_sa_closure_select ON public.mnt_session_closure_events;
CREATE POLICY mnt_sa_closure_select ON public.mnt_session_closure_events FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS mnt_sa_item_exc_select ON public.mnt_session_item_exceptions;
CREATE POLICY mnt_sa_item_exc_select ON public.mnt_session_item_exceptions FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND public.mnt_sa_can_see_session(session_id));
DROP POLICY IF EXISTS mnt_sa_exec_keys_select ON public.mnt_item_execution_keys;
CREATE POLICY mnt_sa_exec_keys_select ON public.mnt_item_execution_keys FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND public.mnt_sa_can_see_item(item_id));
DROP POLICY IF EXISTS mnt_due_changes_select ON public.mnt_due_changes;
CREATE POLICY mnt_due_changes_select ON public.mnt_due_changes FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND (session_id IS NULL OR public.mnt_sa_can_see_session(session_id)));
DROP POLICY IF EXISTS cert_items_select ON public.certificate_items;
CREATE POLICY cert_items_select ON public.certificate_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.certificates c WHERE c.id = certificate_items.certificate_id AND public.user_has_membership(c.company_id))
         AND (maintenance_session_id IS NULL OR public.mnt_sa_can_see_session(maintenance_session_id)));
DROP POLICY IF EXISTS certificates_select ON public.certificates;
CREATE POLICY certificates_select ON public.certificates FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL AND public.mnt_sa_can_see_certificate(id));
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id) AND deleted_at IS NULL
         AND (maintenance_session_id IS NULL OR public.mnt_sa_can_see_session(maintenance_session_id))
         AND (maintenance_item_id IS NULL OR public.mnt_sa_can_see_item(maintenance_item_id))
         AND (certificate_id IS NULL OR public.mnt_sa_can_see_certificate(certificate_id)));
DROP POLICY IF EXISTS notif_events_select ON public.notification_events;
CREATE POLICY notif_events_select ON public.notification_events FOR SELECT TO authenticated
  USING (public.user_has_membership(company_id)
         AND (maintenance_session_id IS NULL OR public.mnt_sa_can_see_session(maintenance_session_id))
         AND (certificate_id IS NULL OR public.mnt_sa_can_see_certificate(certificate_id)));

-- People list for a session: only for those who can see that session.
CREATE OR REPLACE FUNCTION public.mnt_sa_list_session_people(p_company uuid, p_session uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(nullif(pr.full_name, ''), pr.email, 'Usuario'),
           'role', m.role, 'assigned', EXISTS (SELECT 1 FROM public.mnt_session_assignees a WHERE a.session_id = p_session
                                                AND a.user_id = m.user_id AND a.revoked_at IS NULL),
           'technician', s.technician_id = m.user_id) ORDER BY coalesce(pr.full_name, pr.email)), '[]')
    FROM public.maintenance_sessions s JOIN public.company_members m ON m.company_id = s.company_id AND m.active
    LEFT JOIN public.profiles pr ON pr.id = m.user_id
   WHERE s.id = p_session AND s.company_id = p_company AND public.user_has_membership(p_company)
     AND public.mnt_sa_can_see_session(p_session)
     AND m.role IN ('administrator','system_manager','manager','employee');
$$;