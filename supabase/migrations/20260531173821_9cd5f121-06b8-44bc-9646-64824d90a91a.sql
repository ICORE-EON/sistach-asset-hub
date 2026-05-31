
CREATE OR REPLACE FUNCTION public.create_company_with_owner(
  p_name text,
  p_cif text,
  p_address text DEFAULT NULL
) RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company public.companies;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.companies(name, cif, address)
  VALUES (p_name, p_cif, p_address)
  RETURNING * INTO v_company;

  INSERT INTO public.company_members(company_id, user_id, role, is_default, active)
  VALUES (v_company.id, v_user, 'administrator', true, true);

  RETURN v_company;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_with_owner(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(text, text, text) TO authenticated;
