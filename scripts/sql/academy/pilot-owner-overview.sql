-- Development-only deployment candidate. Requires pilot-progress.sql.
BEGIN;

CREATE FUNCTION public.academy_pilot_owner_overview()
RETURNS TABLE (
  advisor_id uuid,
  advisor_name text,
  completed text[],
  last_lesson text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active AND deleted_at IS NULL AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Academy owner access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed advisor'),
           coalesce(progress.completed, ARRAY[]::text[]), progress.last_lesson
    FROM public.profiles p
    LEFT JOIN public.academy_pilot_progress progress ON progress.advisor_id = p.id
    WHERE p.is_active AND p.deleted_at IS NULL AND p.role = 'advisor'
    ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.academy_pilot_owner_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_pilot_owner_overview() TO authenticated;

COMMIT;
