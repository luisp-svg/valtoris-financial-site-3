-- Approved recoverable archive. No tables, columns, hard deletes, or relaxed RLS.
CREATE OR REPLACE FUNCTION public.crm_archive_access(p_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.households h WHERE h.id=p_household_id AND h.merged_into_household_id IS NULL AND (public.crm_is_owner() OR (public.crm_is_advisor() AND h.assigned_advisor_id=public.crm_advisor_id())));
$$;
REVOKE ALL ON FUNCTION public.crm_archive_access(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.archive_crm_record(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE h public.households; l public.leads; hid uuid; ts timestamptz:=clock_timestamp(); oldctx text:=public.crm_rpc_context();
BEGIN
 IF p_kind NOT IN ('household','lead') OR p_kind IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'CRM_ARCHIVE:invalid_record'; END IF;
 IF p_kind='household' THEN hid:=p_id; ELSE SELECT household_id INTO hid FROM public.leads WHERE id=p_id; END IF;
 IF NOT public.crm_archive_access(hid) THEN RAISE EXCEPTION 'CRM_ARCHIVE:not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.households WHERE id=hid FOR UPDATE;
 IF NOT public.crm_archive_access(hid) OR h.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CRM_ARCHIVE:household_unavailable'; END IF;
 IF p_kind='lead' THEN
  SELECT * INTO l FROM public.leads WHERE id=p_id AND household_id=hid FOR UPDATE;
  IF NOT FOUND OR l.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CRM_ARCHIVE:record_unavailable'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.duplicate_reviews d JOIN public.leads x ON x.id=d.incoming_lead_id WHERE d.status='pending' AND x.household_id=hid AND (p_kind='household' OR x.id=p_id)) OR (p_kind='lead' AND l.status='duplicate_review') THEN RAISE EXCEPTION 'CRM_ARCHIVE:resolve_duplicate_first'; END IF;
 PERFORM public.crm_write_activity(hid,'system',CASE WHEN p_kind='household' THEN 'Household archived' ELSE 'Contact / prospect archived' END,'Removed from active views. Linked history retained for recovery.',jsonb_build_object('crm_archive_version',1,'record_kind',p_kind,'record_id',p_id,'archived_at',ts),NULL,NULL,CASE WHEN p_kind='lead' THEN p_id ELSE NULL END,NULL);
 PERFORM set_config('crm.rpc_context','archive_crm_record',true);
 IF p_kind='household' THEN UPDATE public.households SET deleted_at=ts WHERE id=p_id;
 ELSE UPDATE public.leads SET deleted_at=ts WHERE id=p_id; END IF;
 PERFORM set_config('crm.rpc_context',coalesce(oldctx,''),true);
 RETURN jsonb_build_object('ok',true,'kind',p_kind,'id',p_id,'archived',true);
END $$;

CREATE OR REPLACE FUNCTION public.restore_crm_record(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE h public.households; l public.leads; hid uuid; ts timestamptz; oldctx text:=public.crm_rpc_context();
BEGIN
 IF p_kind NOT IN ('household','lead') OR p_kind IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'CRM_ARCHIVE:invalid_record'; END IF;
 IF p_kind='household' THEN hid:=p_id; ELSE SELECT household_id INTO hid FROM public.leads WHERE id=p_id; END IF;
 IF NOT public.crm_archive_access(hid) THEN RAISE EXCEPTION 'CRM_ARCHIVE:not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.households WHERE id=hid FOR UPDATE;
 IF NOT public.crm_archive_access(hid) THEN RAISE EXCEPTION 'CRM_ARCHIVE:not_authorized' USING ERRCODE='42501'; END IF;
 IF p_kind='household' THEN ts:=h.deleted_at;
 ELSE
  IF h.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CRM_ARCHIVE:restore_household_first'; END IF;
  SELECT * INTO l FROM public.leads WHERE id=p_id AND household_id=hid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CRM_ARCHIVE:record_unavailable'; END IF;
  ts:=l.deleted_at;
 END IF;
 IF ts IS NULL OR NOT EXISTS(SELECT 1 FROM public.activities a WHERE a.household_id=hid AND a.deleted_at IS NULL AND a.metadata->>'crm_archive_version'='1' AND a.metadata->>'record_kind'=p_kind AND a.metadata->>'record_id'=p_id::text AND (a.metadata->>'archived_at')::timestamptz=ts) THEN RAISE EXCEPTION 'CRM_ARCHIVE:not_recoverable'; END IF;
 PERFORM set_config('crm.rpc_context','restore_crm_record',true);
 IF p_kind='household' THEN UPDATE public.households SET deleted_at=NULL WHERE id=p_id;
 ELSE UPDATE public.leads SET deleted_at=NULL WHERE id=p_id; END IF;
 PERFORM set_config('crm.rpc_context',coalesce(oldctx,''),true);
 PERFORM public.crm_write_activity(hid,'system','CRM record restored','Returned to active views. Independently archived records remain archived.',jsonb_build_object('record_kind',p_kind,'record_id',p_id,'restored_archive_at',ts),NULL,NULL,CASE WHEN p_kind='lead' THEN p_id ELSE NULL END,NULL);
 RETURN jsonb_build_object('ok',true,'kind',p_kind,'id',p_id,'archived',false);
END $$;

CREATE OR REPLACE FUNCTION public.list_archived_crm_records(p_kind text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid,household_id uuid,display_name text,record_type text,archived_at timestamptz,household_archived boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT(public.crm_is_owner() OR public.crm_is_advisor()) THEN RAISE EXCEPTION 'CRM_ARCHIVE:not_authorized' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('household','lead') OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'CRM_ARCHIVE:invalid_page'; END IF;
 RETURN QUERY
 SELECT r.rid,r.hid,r.label,r.typ,r.ts,r.harch FROM (
 SELECT h.id rid,h.id hid,h.display_name::text label,'Household'::text typ,h.deleted_at ts,true harch FROM public.households h WHERE p_kind='household' AND h.deleted_at IS NOT NULL
 UNION ALL
 SELECT l.id,l.household_id,h.display_name::text,l.lead_type::text,l.deleted_at,h.deleted_at IS NOT NULL FROM public.leads l JOIN public.households h ON h.id=l.household_id WHERE p_kind='lead' AND l.deleted_at IS NOT NULL
 ) r
 WHERE public.crm_archive_access(r.hid) AND EXISTS(SELECT 1 FROM public.activities a WHERE a.household_id=r.hid AND a.deleted_at IS NULL AND a.metadata->>'crm_archive_version'='1' AND a.metadata->>'record_kind'=p_kind AND a.metadata->>'record_id'=r.rid::text AND (a.metadata->>'archived_at')::timestamptz=r.ts)
 ORDER BY r.ts DESC,r.rid LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.archive_crm_record(text,uuid),public.restore_crm_record(text,uuid),public.list_archived_crm_records(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_crm_record(text,uuid),public.restore_crm_record(text,uuid),public.list_archived_crm_records(text,integer,integer) TO authenticated;

-- Permit only the dedicated archive / restore writers for this field.
CREATE OR REPLACE FUNCTION public.enforce_manual_contact_lead_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
  v_is_manual boolean;
BEGIN
  -- Authenticated clients cannot hard-delete Manual Contact leads (archive ≠ delete).
  -- Service-role / SQL maintenance (auth.uid() NULL) remains available for fixtures.
  IF TG_OP = 'DELETE' THEN
    IF OLD.lead_type = 'Manual Contact' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_type = 'Manual Contact' AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  v_is_manual := (OLD.lead_type = 'Manual Contact' OR NEW.lead_type = 'Manual Contact');
  IF NOT v_is_manual THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_type IS DISTINCT FROM OLD.lead_type THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL
     AND coalesce(v_ctx,'') NOT IN ('archive_crm_record','restore_crm_record') THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.consent_snapshot IS DISTINCT FROM OLD.consent_snapshot THEN
    IF v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.contact_category IS DISTINCT FROM OLD.contact_category
     OR NEW.how_we_met IS DISTINCT FROM OLD.how_we_met
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Permit only the dedicated archive / restore writers for this field.
CREATE OR REPLACE FUNCTION public.enforce_manual_contact_household_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lead_source = 'manual_contact' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_source = 'manual_contact' AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.lead_source IS DISTINCT FROM 'manual_contact'
     AND NEW.lead_source IS DISTINCT FROM 'manual_contact' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_source IS DISTINCT FROM OLD.lead_source THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL
     AND coalesce(v_ctx,'') NOT IN ('archive_crm_record','restore_crm_record') THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  -- status/assignment already guarded by households_protect_columns; keep Manual Contact
  -- identity/contact fields RPC-gated here.
  IF NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.primary_email IS DISTINCT FROM OLD.primary_email
     OR NEW.primary_phone IS DISTINCT FROM OLD.primary_phone
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.state IS DISTINCT FROM OLD.state THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Keep incoming-lead archive reasons and task behavior; add recovery provenance.
CREATE OR REPLACE FUNCTION public.archive_intake_lead(
  p_lead_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_lead public.leads;
  v_can_mutate boolean := false;
  v_pending_dup boolean := false;
  v_task public.tasks;
  v_task_completed boolean := false;
  v_completed_task_id uuid := NULL;
  v_assessment_type text := NULL;
  v_product text;
  v_reason_label text;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL
     OR v_reason NOT IN ('dismissed', 'not_a_fit', 'spam', 'test_or_accidental') THEN
    RAISE EXCEPTION 'CRM_INTAKE:invalid_reason'
      USING ERRCODE = '22023';
  END IF;

  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  v_can_mutate := (
    public.crm_is_owner()
    OR public.crm_can_access_household(v_lead.household_id)
  );

  IF NOT v_can_mutate THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF v_lead.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:already_archived'
      USING ERRCODE = '22023';
  END IF;

  IF v_lead.lead_type NOT IN (
    'Family Report Card',
    'Business Report Card',
    'Retirement Report Card',
    'Protection Gap',
    'Student Loan Report Card',
    'Credit Report Card',
    'Digital Identity',
    'Bulk Lead Import',
    'Auto Insurance Quote',
    'Home Insurance Quote',
    'Commercial Insurance Quote'
  ) THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_intake_lead'
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.duplicate_reviews dr
    WHERE dr.incoming_lead_id = v_lead.id
      AND dr.status = 'pending'
  )
  INTO v_pending_dup;

  IF v_lead.status = 'duplicate_review'::public.lead_status
     OR v_pending_dup THEN
    RAISE EXCEPTION 'CRM_INTAKE:duplicate_review_pending'
      USING ERRCODE = '22023';
  END IF;

  IF v_lead.follow_up_task_id IS NOT NULL THEN
    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = v_lead.follow_up_task_id
    FOR UPDATE;

    IF FOUND
       AND v_task.id = v_lead.follow_up_task_id
       AND v_task.lead_id IS NOT DISTINCT FROM v_lead.id
       AND v_task.household_id IS NOT DISTINCT FROM v_lead.household_id
       AND v_task.deleted_at IS NULL
       AND v_task.status IN ('open', 'in_progress')
       AND v_task.workflow_type IN (
         'review_initial_diagnostic',
         'review_digital_identity_lead'
       )
       AND v_task.workflow_type NOT IN (
         'resolve_possible_duplicate',
         'resolve_digital_identity_duplicate'
       ) THEN
      v_task_completed := true;
      v_completed_task_id := v_task.id;
    END IF;
  END IF;

  SELECT a.assessment_type::text
  INTO v_assessment_type
  FROM public.assessments a
  WHERE a.lead_id = v_lead.id
    AND a.deleted_at IS NULL
  ORDER BY a.completed_at DESC NULLS LAST
  LIMIT 1;

  v_product := v_lead.lead_type;
  v_reason_label := CASE v_reason
    WHEN 'dismissed' THEN 'Dismissed'
    WHEN 'not_a_fit' THEN 'Not a Fit'
    WHEN 'spam' THEN 'Spam'
    WHEN 'test_or_accidental' THEN 'Test / Accidental'
  END;

  v_meta := jsonb_build_object(
    'crm_archive_version', 1,
    'record_kind', 'lead',
    'record_id', v_lead.id,
    'archived_at', now(),
    'lead_id', v_lead.id,
    'household_id', v_lead.household_id,
    'archive_reason', v_reason,
    'lead_type', v_lead.lead_type,
    'follow_up_task_completed', v_task_completed
  );

  IF v_assessment_type IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('assessment_type', v_assessment_type);
  END IF;

  IF v_task_completed AND v_completed_task_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('follow_up_task_id', v_completed_task_id);
  END IF;

  PERFORM public.crm_write_activity(
    v_lead.household_id,
    'system'::public.activity_type,
    'Intake archived',
    v_product || ' Intake archived as ' || v_reason_label || '.',
    v_meta,
    NULL,
    NULL,
    v_lead.id,
    NULL
  );

  IF v_task_completed AND v_completed_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET
      status = 'done',
      completed_at = now()
    WHERE id = v_completed_task_id
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress')
      AND workflow_type IN (
        'review_initial_diagnostic',
        'review_digital_identity_lead'
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.leads
  SET deleted_at = now()
  WHERE id = v_lead.id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_INTAKE:already_archived'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'archived', true,
    'reason', v_reason,
    'follow_up_task_completed', v_task_completed
  );
END;
$$;
