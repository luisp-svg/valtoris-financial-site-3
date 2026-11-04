-- Local release candidate. Apply before deploying the directory UI.
-- SECURITY INVOKER intentionally preserves household, intake-summary, member,
-- advisor and stage RLS. No user/advisor identity is accepted for authorization.
BEGIN;

CREATE FUNCTION public.search_household_directory(
  p_search text DEFAULT '',
  p_stage_id uuid DEFAULT NULL,
  p_advisor_id uuid DEFAULT NULL,
  p_assignment text DEFAULT 'all',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF p_assignment IS NULL OR p_assignment NOT IN ('all', 'assigned', 'unassigned')
    OR p_page IS NULL OR p_page < 1
    OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100
    OR length(coalesce(p_search, '')) > 256 THEN
    RAISE EXCEPTION 'Invalid household directory filters' USING ERRCODE = '22023';
  END IF;

  WITH eligible AS MATERIALIZED (
    SELECT h.id, h.display_name, h.status, h.primary_email, h.primary_phone,
      h.assigned_advisor_id, h.relationship_stage_id, h.updated_at
    FROM public.households h
    WHERE h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
      AND (h.status <> 'lead' OR h.lead_source IS NULL OR h.lead_source <> 'manual_contact')
  ), matched AS MATERIALIZED (
    SELECT h.* FROM eligible h
    WHERE (p_stage_id IS NULL OR h.relationship_stage_id = p_stage_id)
      AND (p_advisor_id IS NULL OR h.assigned_advisor_id = p_advisor_id)
      AND (p_assignment <> 'assigned' OR h.assigned_advisor_id IS NOT NULL)
      AND (p_assignment <> 'unassigned' OR h.assigned_advisor_id IS NULL)
      AND (
        btrim(coalesce(p_search, '')) = ''
        OR strpos(lower(h.display_name), lower(btrim(p_search))) > 0
        OR EXISTS (
          SELECT 1 FROM public.household_members m
          WHERE m.household_id = h.id AND m.deleted_at IS NULL
            AND strpos(lower(btrim(concat_ws(' ', m.first_name, m.last_name))), lower(btrim(p_search))) > 0
        )
      )
  ), bounds AS (
    SELECT count(*) AS total,
      least(p_page::bigint, greatest(1::bigint, (count(*) + p_page_size - 1) / p_page_size)) AS page
    FROM matched
  ), page_rows AS (
    SELECT h.* FROM matched h
    ORDER BY h.updated_at DESC, h.id ASC
    LIMIT p_page_size OFFSET (SELECT (page - 1) * p_page_size FROM bounds)
  ), directory_rows AS (
    SELECT h.*,
      (SELECT jsonb_build_object('id', a.id, 'display_name', a.display_name)
        FROM public.advisor_profiles a WHERE a.id = h.assigned_advisor_id) AS assigned_advisor,
      (SELECT jsonb_build_object('id', s.id, 'name', s.name, 'code', s.code)
        FROM public.pipeline_stages s WHERE s.id = h.relationship_stage_id) AS relationship_stage,
      (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'household_id', m.household_id,
        'first_name', m.first_name, 'last_name', m.last_name,
        'relationship', m.relationship, 'is_primary_contact', m.is_primary_contact,
        'email', m.email, 'phone', m.phone,
        'created_at', m.created_at, 'updated_at', m.updated_at
      ) ORDER BY m.id), '[]'::jsonb)
        FROM public.household_members m WHERE m.household_id = h.id AND m.deleted_at IS NULL) AS members
    FROM page_rows h
  ), stages AS (
    SELECT DISTINCT s.id, s.name FROM eligible h
    JOIN public.pipeline_stages s ON s.id = h.relationship_stage_id
  ), advisors AS (
    SELECT DISTINCT a.id, a.display_name AS name FROM eligible h
    JOIN public.advisor_profiles a ON a.id = h.assigned_advisor_id
  )
  SELECT jsonb_build_object(
    'rows', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC, r.id ASC), '[]'::jsonb) FROM directory_rows r),
    'total', b.total, 'page', b.page, 'pageSize', p_page_size,
    'stages', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.name, s.id), '[]'::jsonb) FROM stages s),
    'advisors', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.name, a.id), '[]'::jsonb) FROM advisors a)
  ) INTO result FROM bounds b;
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_household_directory(text, uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_household_directory(text, uuid, uuid, text, integer, integer) TO authenticated;
COMMENT ON FUNCTION public.search_household_directory(text, uuid, uuid, text, integer, integer) IS
  'RLS-preserving household directory: literal household/member search, filters, exact total and stable pages; no date of birth or intake answers.';

COMMIT;
