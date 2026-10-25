REVOKE ALL ON public.mnt_due_changes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mnt_due_changes FROM authenticated;
GRANT SELECT ON public.mnt_due_changes TO authenticated;