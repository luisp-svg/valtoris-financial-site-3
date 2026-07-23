-- CRM-7.1: narrowly scoped SECURITY DEFINER RPC for authenticated note soft-delete.
--
-- Direct UPDATE ... SET deleted_at fails when SELECT requires deleted_at IS NULL,
-- because PostgreSQL evaluates RLS against the updated row.
-- This function preserves deleted-row invisibility while allowing authorized
-- soft deletion through a narrow SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.soft_delete_note(p_note_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_note public.notes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_note_id IS NULL THEN
    RAISE EXCEPTION 'cannot soft-delete note';
  END IF;

  SELECT *
  INTO v_note
  FROM public.notes
  WHERE id = p_note_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_note.deleted_at IS NOT NULL
     OR NOT (
       public.crm_is_owner()
       OR public.crm_can_access_household(v_note.household_id)
     ) THEN
    RAISE EXCEPTION 'cannot soft-delete note';
  END IF;

  UPDATE public.notes
  SET deleted_at = now()
  WHERE id = v_note.id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot soft-delete note';
  END IF;

  RETURN v_note.id;
END;
$$;

ALTER FUNCTION public.soft_delete_note(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.soft_delete_note(uuid) IS
  'Authenticated soft-delete for an accessible household note. Sets deleted_at only. Authorization uses crm_is_owner/crm_can_access_household on the note row household_id. Does not accept caller-supplied household_id. Owner hard DELETE policy remains separate.';

REVOKE ALL ON FUNCTION public.soft_delete_note(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_note(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.soft_delete_note(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_note(uuid) TO authenticated;