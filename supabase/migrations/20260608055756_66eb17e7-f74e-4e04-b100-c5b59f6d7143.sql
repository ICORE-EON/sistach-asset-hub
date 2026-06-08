
-- ============ company_invitations ============
CREATE TABLE public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_invitations_company ON public.company_invitations(company_id);
CREATE INDEX idx_company_invitations_email ON public.company_invitations(lower(email));
CREATE INDEX idx_company_invitations_token ON public.company_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invitations TO authenticated;
GRANT SELECT ON public.company_invitations TO anon;
GRANT ALL ON public.company_invitations TO service_role;

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_invitations_select_admin ON public.company_invitations
  FOR SELECT TO authenticated
  USING (can_manage_company(company_id));

CREATE POLICY company_invitations_modify_admin ON public.company_invitations
  FOR ALL TO authenticated
  USING (can_manage_company(company_id))
  WITH CHECK (can_manage_company(company_id));

CREATE TRIGGER trg_company_invitations_updated
  BEFORE UPDATE ON public.company_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RPC: lookup by token (bypass RLS for anon/auth) ============
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid, company_id uuid, company_name text, email text, role app_role,
  expires_at timestamptz, accepted_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT i.id, i.company_id, c.name, i.email, i.role, i.expires_at, i.accepted_at
  FROM public.company_invitations i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated, anon;

-- ============ RPC: invite ============
CREATE OR REPLACE FUNCTION public.invite_company_member(
  p_company_id uuid, p_email text, p_role app_role
) RETURNS public.company_invitations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.company_invitations;
BEGIN
  IF NOT public.can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email required';
  END IF;

  INSERT INTO public.company_invitations(company_id, email, role, invited_by)
  VALUES (p_company_id, lower(p_email), p_role, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.invite_company_member(uuid, text, app_role) TO authenticated;

-- ============ RPC: accept ============
CREATE OR REPLACE FUNCTION public.accept_company_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inv public.company_invitations;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.company_invitations WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  INSERT INTO public.company_members(company_id, user_id, role, active, is_default)
  VALUES (v_inv.company_id, v_user, v_inv.role, true,
          NOT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = v_user AND active = true))
  ON CONFLICT (company_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, active = true, left_at = NULL;

  UPDATE public.company_invitations
    SET accepted_at = now(), accepted_by = v_user, updated_at = now()
    WHERE id = v_inv.id;

  RETURN v_inv.company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

-- company_members lacks UNIQUE(company_id, user_id); add it for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_members'::regclass
      AND conname = 'company_members_company_user_uniq'
  ) THEN
    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_company_user_uniq UNIQUE (company_id, user_id);
  END IF;
END $$;

-- ============ RPC: set counter ============
CREATE OR REPLACE FUNCTION public.set_company_counter(
  p_company_id uuid, p_scope text, p_year int, p_value bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.can_manage_company(p_company_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_value < 0 THEN
    RAISE EXCEPTION 'Value must be >= 0';
  END IF;
  INSERT INTO public.counters(company_id, scope, year, value)
  VALUES (p_company_id, p_scope, p_year, p_value)
  ON CONFLICT (company_id, scope, year) DO UPDATE SET value = EXCLUDED.value;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_company_counter(uuid, text, int, bigint) TO authenticated;
