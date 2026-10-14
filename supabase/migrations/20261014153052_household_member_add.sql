CREATE OR REPLACE FUNCTION public.enforce_manual_contact_member_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
  v_hh uuid := COALESCE(NEW.household_id, OLD.household_id);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.quick_add_is_manual_household(OLD.household_id) AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT public.quick_add_is_manual_household(v_hh) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'quick_add_contact'
       AND NOT (coalesce(v_ctx,'') = 'household_member_add' AND NOT NEW.is_primary_contact) THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
     OR NEW.company IS DISTINCT FROM OLD.company
     OR NEW.job_title IS DISTINCT FROM OLD.job_title
     OR NEW.website IS DISTINCT FROM OLD.website
     OR NEW.is_primary_contact IS DISTINCT FROM OLD.is_primary_contact
     OR NEW.relationship IS DISTINCT FROM OLD.relationship THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Invoker keeps household-member RLS in force. Only adds non-primary members;
-- the linked Manual Contact and primary contact remain on their dedicated RPCs.
CREATE OR REPLACE FUNCTION public.add_household_member(p_household_id uuid, p_member jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, extensions AS $$
DECLARE v_member public.household_members; v_previous text; v_phone text; v_digits text; v_normalized_phone text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.crm_can_access_household(p_household_id) THEN
    RAISE EXCEPTION 'Member cannot be added to this household' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id=p_household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL) THEN
    RAISE EXCEPTION 'Household is unavailable' USING ERRCODE='22023';
  END IF;
  IF coalesce((p_member->>'is_primary_contact')::boolean,false) THEN
    RAISE EXCEPTION 'Update the linked contact to change the primary contact' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_member->>'first_name'),'') IS NULL OR nullif(btrim(p_member->>'last_name'),'') IS NULL THEN
    RAISE EXCEPTION 'First and last name are required' USING ERRCODE='22023';
  END IF;
  v_phone := nullif(btrim(p_member->>'phone'),'');
  v_digits := nullif(regexp_replace(coalesce(v_phone,''),'\D','','g'),'');
  v_normalized_phone := CASE WHEN length(v_digits)=10 THEN '+1'||v_digits
    WHEN (length(v_digits)=11 AND left(v_digits,1)='1') OR (left(v_phone,1)='+' AND length(v_digits)>=8) OR length(v_digits)>11 THEN '+'||v_digits
    ELSE v_digits END;
  v_previous := current_setting('crm.rpc_context',true);
  PERFORM set_config('crm.rpc_context','household_member_add',true);
  INSERT INTO public.household_members(household_id,first_name,last_name,relationship,is_primary_contact,email,normalized_email,phone,normalized_phone,date_of_birth)
  VALUES(p_household_id,btrim(p_member->>'first_name'),btrim(p_member->>'last_name'),coalesce(p_member->>'relationship','other')::public.member_relationship,false,
    nullif(btrim(p_member->>'email'),''),nullif(lower(btrim(p_member->>'email')),''),nullif(btrim(p_member->>'phone'),''),v_normalized_phone,nullif(p_member->>'date_of_birth','')::date)
  RETURNING * INTO v_member;
  PERFORM set_config('crm.rpc_context',coalesce(v_previous,''),true);
  RETURN to_jsonb(v_member);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('crm.rpc_context',coalesce(v_previous,''),true);
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.add_household_member(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_household_member(uuid,jsonb) TO authenticated;
