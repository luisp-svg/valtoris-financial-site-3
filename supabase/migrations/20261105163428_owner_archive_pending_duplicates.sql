-- Owners may recoverably archive records with pending duplicates. Reviews remain pending; no hard deletion or merge.
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
 IF NOT public.crm_is_owner() AND (EXISTS(SELECT 1 FROM public.duplicate_reviews d JOIN public.leads x ON x.id=d.incoming_lead_id WHERE d.status='pending' AND x.household_id=hid AND (p_kind='household' OR x.id=p_id)) OR (p_kind='lead' AND l.status='duplicate_review')) THEN RAISE EXCEPTION 'CRM_ARCHIVE:resolve_duplicate_first'; END IF;
 PERFORM public.crm_write_activity(hid,'system',CASE WHEN p_kind='household' THEN 'Household archived' ELSE 'Contact / prospect archived' END,'Removed from active views. Linked history retained for recovery.',jsonb_build_object('crm_archive_version',1,'record_kind',p_kind,'record_id',p_id,'archived_at',ts),NULL,NULL,CASE WHEN p_kind='lead' THEN p_id ELSE NULL END,NULL);
 PERFORM set_config('crm.rpc_context','archive_crm_record',true);
 IF p_kind='household' THEN UPDATE public.households SET deleted_at=ts WHERE id=p_id;
 ELSE UPDATE public.leads SET deleted_at=ts WHERE id=p_id; END IF;
 PERFORM set_config('crm.rpc_context',coalesce(oldctx,''),true);
 RETURN jsonb_build_object('ok',true,'kind',p_kind,'id',p_id,'archived',true);
END $$;
REVOKE ALL ON FUNCTION public.archive_crm_record(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_crm_record(text,uuid) TO authenticated;
