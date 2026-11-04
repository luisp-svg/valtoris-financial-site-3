-- Agent-entered classifications; these do not establish verified writing authority.
ALTER TABLE public.recruit_records
 ADD COLUMN license_types text[] NOT NULL DEFAULT '{}' CHECK (license_types <@ ARRAY['life_only','life_health','property_casualty']::text[] AND array_position(license_types,NULL) IS NULL AND cardinality(license_types)<=3),
 ADD COLUMN appointing_organization text CHECK (appointing_organization IN ('empower','experior')),
 ADD COLUMN contract_level text CHECK (length(btrim(contract_level)) BETWEEN 1 AND 120);

CREATE OR REPLACE FUNCTION public.recruit_command(p_recruit_id uuid,p_revision integer,p_action text,p_payload jsonb,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE r public.recruit_records%ROWTYPE; old_data jsonb; new_data jsonb; child_id uuid; linked uuid;
BEGIN
 IF NOT public.crm_can_manage_recruiting() THEN RAISE EXCEPTION 'Recruiting management access required'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>20000 THEN RAISE EXCEPTION 'Invalid recruiting form'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Change reason required'; END IF;
 IF p_action IN ('create','edit') AND p_payload ? 'license_types' AND jsonb_typeof(p_payload->'license_types') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'License types must be a list';
 END IF;
 IF p_action='create' THEN
   IF p_recruit_id IS NOT NULL THEN RAISE EXCEPTION 'New recruit cannot have an existing ID'; END IF;
   PERFORM public.pp_assert_object_keys(p_payload,ARRAY['full_name','email','phone','assigned_advisor_id','license_types','appointing_organization','contract_level']);
   linked:=nullif(p_payload->>'assigned_advisor_id','')::uuid;
   IF linked IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=linked AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN ('advisor','owner')) THEN RAISE EXCEPTION 'Assigned advisor unavailable'; END IF;
   -- Existing identity matches require deliberate linking, not a second invite/account.
   INSERT INTO public.recruit_records(full_name,email,phone,assigned_advisor_id,created_by,license_types,appointing_organization,contract_level)
   VALUES(btrim(p_payload->>'full_name'),lower(btrim(p_payload->>'email')),nullif(btrim(p_payload->>'phone'),''),linked,auth.uid(),ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_payload->'license_types','[]'::jsonb)) ORDER BY 1),nullif(p_payload->>'appointing_organization',''),nullif(btrim(p_payload->>'contract_level'),'')) RETURNING * INTO r;
   new_data:=to_jsonb(r);
 ELSE
   SELECT * INTO r FROM public.recruit_records WHERE id=p_recruit_id FOR UPDATE;
   IF r.id IS NULL THEN RAISE EXCEPTION 'Recruit not available'; END IF;
   IF p_revision IS NULL OR p_revision<>r.revision THEN RAISE EXCEPTION 'This recruit changed. Refresh before saving.'; END IF;
   IF r.is_archived AND p_action<>'edit' THEN RAISE EXCEPTION 'Restore the recruit before editing requirements'; END IF;
   IF p_action='edit' THEN
     PERFORM public.pp_assert_object_keys(p_payload,ARRAY['full_name','email','phone','assigned_advisor_id','advisor_profile_id','stage','next_action','next_action_due_on','is_archived','license_types','appointing_organization','contract_level']);
     old_data:=to_jsonb(r);
     linked:=nullif(p_payload->>'assigned_advisor_id','')::uuid;
     IF linked IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=linked AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN ('advisor','owner')) THEN RAISE EXCEPTION 'Assigned advisor unavailable'; END IF;
     linked:=nullif(p_payload->>'advisor_profile_id','')::uuid;
     IF linked IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=linked AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND lower(btrim(p.email::text))=lower(btrim(p_payload->>'email'))) THEN RAISE EXCEPTION 'Linked advisor email must match this recruit'; END IF;
     IF p_payload->>'stage' IN ('ready_to_write','active_agent') AND p_payload->>'stage' IS DISTINCT FROM r.stage THEN
       IF NOT EXISTS(SELECT 1 FROM public.recruit_carrier_readiness a WHERE a.recruit_id=r.id AND public.recruit_scope_ready(a.id)) THEN RAISE EXCEPTION 'Current verified license, E&O, contracting, appointment and manager review are required for at least one scope'; END IF;
     END IF;
     IF p_payload->>'stage'='active_agent' AND (r.stage<>'active_agent' OR linked IS DISTINCT FROM r.advisor_profile_id) AND NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=linked AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role='advisor') THEN RAISE EXCEPTION 'Active Agent needs a linked active advisor account'; END IF;
     UPDATE public.recruit_records SET full_name=btrim(p_payload->>'full_name'),email=lower(btrim(p_payload->>'email')),phone=nullif(btrim(p_payload->>'phone'),''),
       assigned_advisor_id=nullif(p_payload->>'assigned_advisor_id','')::uuid,advisor_profile_id=linked,stage=p_payload->>'stage',
       next_action=nullif(btrim(p_payload->>'next_action'),''),next_action_due_on=nullif(p_payload->>'next_action_due_on','')::date,
       license_types=CASE WHEN p_payload ? 'license_types' THEN ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_payload->'license_types') ORDER BY 1) ELSE r.license_types END,
       appointing_organization=CASE WHEN p_payload ? 'appointing_organization' THEN nullif(p_payload->>'appointing_organization','') ELSE r.appointing_organization END,
       contract_level=CASE WHEN p_payload ? 'contract_level' THEN nullif(btrim(p_payload->>'contract_level'),'') ELSE r.contract_level END,
       is_archived=coalesce((p_payload->>'is_archived')::boolean,false) WHERE id=r.id RETURNING to_jsonb(recruit_records.*) INTO new_data;
   ELSIF p_action='credential' THEN
     PERFORM public.pp_assert_object_keys(p_payload,ARRAY['id','kind','state','authority_scope','provider_reference','effective_on','expires_on','no_expiration','status','evidence_reference']);
     child_id:=nullif(p_payload->>'id','')::uuid;
     IF child_id IS NOT NULL THEN
       SELECT to_jsonb(c) INTO old_data FROM public.recruit_credentials c WHERE id=child_id AND recruit_id=r.id;
       IF old_data IS NULL THEN RAISE EXCEPTION 'Credential not available'; END IF;
     ELSE child_id:=extensions.gen_random_uuid(); END IF;
     INSERT INTO public.recruit_credentials(id,recruit_id,kind,state,authority_scope,provider_reference,effective_on,expires_on,no_expiration,status,evidence_reference,verified_by,verified_at)
     VALUES(child_id,r.id,p_payload->>'kind',nullif(upper(btrim(p_payload->>'state')),''),nullif(lower(btrim(p_payload->>'authority_scope')),''),btrim(p_payload->>'provider_reference'),nullif(p_payload->>'effective_on','')::date,nullif(p_payload->>'expires_on','')::date,coalesce((p_payload->>'no_expiration')::boolean,false),p_payload->>'status',nullif(btrim(p_payload->>'evidence_reference'),''),CASE WHEN p_payload->>'status'='verified' THEN auth.uid() END,CASE WHEN p_payload->>'status'='verified' THEN now() END)
     ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,state=EXCLUDED.state,authority_scope=EXCLUDED.authority_scope,provider_reference=EXCLUDED.provider_reference,effective_on=EXCLUDED.effective_on,expires_on=EXCLUDED.expires_on,no_expiration=EXCLUDED.no_expiration,status=EXCLUDED.status,evidence_reference=EXCLUDED.evidence_reference,verified_by=EXCLUDED.verified_by,verified_at=EXCLUDED.verified_at,updated_at=now()
     RETURNING to_jsonb(recruit_credentials.*) INTO new_data;
     -- Any evidence change requires a fresh carrier-scope review.
     UPDATE public.recruit_carrier_readiness SET reviewed_by=NULL,reviewed_at=NULL WHERE recruit_id=r.id;
   ELSIF p_action='carrier' THEN
     PERFORM public.pp_assert_object_keys(p_payload,ARRAY['id','carrier_id','state','authority_scope','contract_status','contract_effective_on','contract_expires_on','contract_no_expiration','contract_evidence','appointment_status','appointment_effective_on','appointment_expires_on','appointment_no_expiration','appointment_evidence','review_now']);
     child_id:=nullif(p_payload->>'id','')::uuid;
     IF child_id IS NOT NULL THEN
       SELECT to_jsonb(c) INTO old_data FROM public.recruit_carrier_readiness c WHERE id=child_id AND recruit_id=r.id;
       IF old_data IS NULL THEN RAISE EXCEPTION 'Carrier review not available'; END IF;
     ELSE child_id:=extensions.gen_random_uuid(); END IF;
     IF NOT EXISTS(SELECT 1 FROM public.carriers WHERE id=(p_payload->>'carrier_id')::uuid AND is_active AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Carrier unavailable'; END IF;
     INSERT INTO public.recruit_carrier_readiness(id,recruit_id,carrier_id,state,authority_scope,contract_status,contract_effective_on,contract_expires_on,contract_no_expiration,contract_evidence,appointment_status,appointment_effective_on,appointment_expires_on,appointment_no_expiration,appointment_evidence,reviewed_by,reviewed_at)
     VALUES(child_id,r.id,(p_payload->>'carrier_id')::uuid,upper(btrim(p_payload->>'state')),lower(btrim(p_payload->>'authority_scope')),p_payload->>'contract_status',nullif(p_payload->>'contract_effective_on','')::date,nullif(p_payload->>'contract_expires_on','')::date,coalesce((p_payload->>'contract_no_expiration')::boolean,false),nullif(btrim(p_payload->>'contract_evidence'),''),p_payload->>'appointment_status',nullif(p_payload->>'appointment_effective_on','')::date,nullif(p_payload->>'appointment_expires_on','')::date,coalesce((p_payload->>'appointment_no_expiration')::boolean,false),nullif(btrim(p_payload->>'appointment_evidence'),''),CASE WHEN (p_payload->>'review_now')::boolean THEN auth.uid() END,CASE WHEN (p_payload->>'review_now')::boolean THEN now() END)
     ON CONFLICT(id) DO UPDATE SET carrier_id=EXCLUDED.carrier_id,state=EXCLUDED.state,authority_scope=EXCLUDED.authority_scope,contract_status=EXCLUDED.contract_status,contract_effective_on=EXCLUDED.contract_effective_on,contract_expires_on=EXCLUDED.contract_expires_on,contract_no_expiration=EXCLUDED.contract_no_expiration,contract_evidence=EXCLUDED.contract_evidence,appointment_status=EXCLUDED.appointment_status,appointment_effective_on=EXCLUDED.appointment_effective_on,appointment_expires_on=EXCLUDED.appointment_expires_on,appointment_no_expiration=EXCLUDED.appointment_no_expiration,appointment_evidence=EXCLUDED.appointment_evidence,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,updated_at=now()
     RETURNING to_jsonb(recruit_carrier_readiness.*) INTO new_data;
   ELSE RAISE EXCEPTION 'Unknown recruiting action'; END IF;
   UPDATE public.recruit_records SET revision=revision+1,updated_at=now() WHERE id=r.id;
   IF p_action='edit' THEN SELECT to_jsonb(x) INTO new_data FROM public.recruit_records x WHERE id=r.id; END IF;
 END IF;
 INSERT INTO public.recruit_history(recruit_id,actor_id,action,reason,before_data,after_data) VALUES(r.id,auth.uid(),p_action,btrim(p_reason),old_data,new_data);
 INSERT INTO public.audit_logs(actor_user_id,action,entity_table,entity_id) VALUES(auth.uid(),'recruiting.'||p_action,'recruit_records',r.id);
 RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.recruit_command(uuid,integer,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recruit_command(uuid,integer,text,jsonb,text) TO authenticated;
