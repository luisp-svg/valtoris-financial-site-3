-- Recruiting records are not households or authentication accounts.
INSERT INTO public.app_settings(key,value) VALUES ('recruiting_managers','{"user_ids":[]}') ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION public.crm_can_manage_recruiting() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT public.crm_is_owner() OR (public.crm_is_advisor() AND public.crm_advisor_id() IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.app_settings WHERE key='recruiting_managers'
     AND value->'user_ids' @> jsonb_build_array(auth.uid()::text)));
$$;
REVOKE ALL ON FUNCTION public.crm_can_manage_recruiting() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_manage_recruiting() TO authenticated;

CREATE TABLE public.recruit_records (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 full_name text NOT NULL CHECK(length(btrim(full_name)) BETWEEN 1 AND 200),
 email extensions.citext NOT NULL CHECK(email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND length(email::text)<=254),
 phone text CHECK(length(phone)<=80),
 advisor_profile_id uuid UNIQUE REFERENCES public.advisor_profiles(id) ON DELETE RESTRICT,
 assigned_advisor_id uuid REFERENCES public.advisor_profiles(id) ON DELETE RESTRICT,
 stage text NOT NULL DEFAULT 'recruit' CHECK(stage IN ('recruit','licensing','eo','contracting','carrier_appointments','ready_to_write','active_agent','paused','withdrawn')),
 next_action text CHECK(length(next_action)<=1000), next_action_due_on date,
 is_archived boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recruit_email_unique ON public.recruit_records(lower(btrim(email::text)));
CREATE INDEX recruit_assignment ON public.recruit_records(assigned_advisor_id,stage);

CREATE TABLE public.recruit_credentials (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 recruit_id uuid NOT NULL REFERENCES public.recruit_records(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('license','eo')),
 state text, authority_scope text,
 provider_reference text NOT NULL CHECK(length(btrim(provider_reference)) BETWEEN 1 AND 300),
 effective_on date, expires_on date, no_expiration boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK(status IN ('reported','verified','revoked')),
 evidence_reference text CHECK(length(evidence_reference)<=1000),
 verified_by uuid REFERENCES public.profiles(id), verified_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='license' AND state IS NOT NULL AND state ~ '^[A-Z]{2}$' AND authority_scope IS NOT NULL AND length(btrim(authority_scope)) BETWEEN 1 AND 120)
   OR (kind='eo' AND state IS NULL AND authority_scope IS NULL)),
 CHECK(NOT(no_expiration AND expires_on IS NOT NULL)),
 CHECK(expires_on IS NULL OR effective_on IS NULL OR expires_on>=effective_on),
 CHECK(status<>'verified' OR (effective_on IS NOT NULL AND (expires_on IS NOT NULL OR no_expiration)
   AND evidence_reference IS NOT NULL AND length(btrim(evidence_reference))>0 AND verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX recruit_credential_scope ON public.recruit_credentials(recruit_id,kind,coalesce(state,''),coalesce(authority_scope,''));
CREATE INDEX recruit_credentials_parent ON public.recruit_credentials(recruit_id);

CREATE TABLE public.recruit_carrier_readiness (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 recruit_id uuid NOT NULL REFERENCES public.recruit_records(id) ON DELETE RESTRICT,
 carrier_id uuid NOT NULL REFERENCES public.carriers(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state ~ '^[A-Z]{2}$'),
 authority_scope text NOT NULL CHECK(length(btrim(authority_scope)) BETWEEN 1 AND 120),
 contract_status text NOT NULL CHECK(contract_status IN ('pending','verified','revoked')),
 contract_effective_on date, contract_expires_on date, contract_no_expiration boolean NOT NULL DEFAULT false,
 contract_evidence text CHECK(length(contract_evidence)<=1000),
 appointment_status text NOT NULL CHECK(appointment_status IN ('pending','verified','revoked')),
 appointment_effective_on date, appointment_expires_on date, appointment_no_expiration boolean NOT NULL DEFAULT false,
 appointment_evidence text CHECK(length(appointment_evidence)<=1000),
 reviewed_by uuid REFERENCES public.profiles(id), reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(recruit_id,carrier_id,state,authority_scope),
 CHECK(NOT(contract_no_expiration AND contract_expires_on IS NOT NULL)),
 CHECK(NOT(appointment_no_expiration AND appointment_expires_on IS NOT NULL)),
 CHECK(contract_expires_on IS NULL OR contract_effective_on IS NULL OR contract_expires_on>=contract_effective_on),
 CHECK(appointment_expires_on IS NULL OR appointment_effective_on IS NULL OR appointment_expires_on>=appointment_effective_on),
 CHECK(contract_status<>'verified' OR (contract_effective_on IS NOT NULL AND (contract_expires_on IS NOT NULL OR contract_no_expiration) AND contract_evidence IS NOT NULL AND length(btrim(contract_evidence))>0)),
 CHECK(appointment_status<>'verified' OR (appointment_effective_on IS NOT NULL AND (appointment_expires_on IS NOT NULL OR appointment_no_expiration) AND appointment_evidence IS NOT NULL AND length(btrim(appointment_evidence))>0))
);
CREATE INDEX recruit_carrier_parent ON public.recruit_carrier_readiness(recruit_id);
CREATE TABLE public.recruit_history (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 recruit_id uuid NOT NULL REFERENCES public.recruit_records(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 action text NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 before_data jsonb, after_data jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recruit_history_parent ON public.recruit_history(recruit_id,occurred_at);

CREATE FUNCTION public.crm_can_read_recruit(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT public.crm_can_manage_recruiting() OR (public.crm_is_advisor() AND EXISTS(
 SELECT 1 FROM public.recruit_records r WHERE r.id=p_id AND NOT r.is_archived
 AND r.advisor_profile_id=public.crm_advisor_id()));
$$;
REVOKE ALL ON FUNCTION public.crm_can_read_recruit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_can_read_recruit(uuid) TO authenticated;
ALTER TABLE public.recruit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_carrier_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruit_records,public.recruit_credentials,public.recruit_carrier_readiness,public.recruit_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.recruit_records,public.recruit_credentials,public.recruit_carrier_readiness,public.recruit_history TO authenticated;
CREATE POLICY recruit_read ON public.recruit_records FOR SELECT TO authenticated USING(public.crm_can_read_recruit(id));
CREATE POLICY recruit_credential_read ON public.recruit_credentials FOR SELECT TO authenticated USING(public.crm_can_read_recruit(recruit_id));
CREATE POLICY recruit_carrier_read ON public.recruit_carrier_readiness FOR SELECT TO authenticated USING(public.crm_can_read_recruit(recruit_id));
CREATE POLICY recruit_history_read ON public.recruit_history FOR SELECT TO authenticated USING(public.crm_can_manage_recruiting());

-- Internal predicate; callable only from authorized functions below.
CREATE FUNCTION public.recruit_scope_ready(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT EXISTS(SELECT 1 FROM public.recruit_carrier_readiness a
 JOIN public.recruit_records r ON r.id=a.recruit_id AND NOT r.is_archived
 JOIN public.carriers c ON c.id=a.carrier_id AND c.is_active AND c.deleted_at IS NULL
 WHERE a.id=p_id AND a.reviewed_at IS NOT NULL
 AND a.contract_status='verified' AND a.contract_effective_on<=current_date
 AND (a.contract_expires_on>=current_date OR a.contract_no_expiration)
 AND a.appointment_status='verified' AND a.appointment_effective_on<=current_date
 AND (a.appointment_expires_on>=current_date OR a.appointment_no_expiration)
 AND EXISTS(SELECT 1 FROM public.recruit_credentials l WHERE l.recruit_id=a.recruit_id AND l.kind='license'
   AND l.state=a.state AND lower(btrim(l.authority_scope))=lower(btrim(a.authority_scope)) AND l.status='verified'
   AND l.effective_on<=current_date AND (l.expires_on>=current_date OR l.no_expiration))
 AND EXISTS(SELECT 1 FROM public.recruit_credentials e WHERE e.recruit_id=a.recruit_id AND e.kind='eo'
   AND e.status='verified' AND e.effective_on<=current_date AND (e.expires_on>=current_date OR e.no_expiration)));
$$;
REVOKE ALL ON FUNCTION public.recruit_scope_ready(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.recruit_readiness(p_recruit_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
BEGIN
 IF NOT public.crm_can_read_recruit(p_recruit_id) THEN RAISE EXCEPTION 'Recruit not available'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'carrier_name',c.name,'state',a.state,'authority_scope',a.authority_scope,'ready',public.recruit_scope_ready(a.id)) ORDER BY c.name,a.state,a.authority_scope),'[]') FROM public.recruit_carrier_readiness a JOIN public.carriers c ON c.id=a.carrier_id WHERE a.recruit_id=p_recruit_id);
END $$;
REVOKE ALL ON FUNCTION public.recruit_readiness(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recruit_readiness(uuid) TO authenticated;

CREATE FUNCTION public.recruit_command(p_recruit_id uuid,p_revision integer,p_action text,p_payload jsonb,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE r public.recruit_records%ROWTYPE; old_data jsonb; new_data jsonb; child_id uuid; linked uuid;
BEGIN
 IF NOT public.crm_can_manage_recruiting() THEN RAISE EXCEPTION 'Recruiting management access required'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>20000 THEN RAISE EXCEPTION 'Invalid recruiting form'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Change reason required'; END IF;
 IF p_action='create' THEN
   IF p_recruit_id IS NOT NULL THEN RAISE EXCEPTION 'New recruit cannot have an existing ID'; END IF;
   PERFORM public.pp_assert_object_keys(p_payload,ARRAY['full_name','email','phone','assigned_advisor_id']);
   linked:=nullif(p_payload->>'assigned_advisor_id','')::uuid;
   IF linked IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.advisor_profiles a JOIN public.profiles p ON p.id=a.user_id WHERE a.id=linked AND a.is_active AND a.deleted_at IS NULL AND p.is_active AND p.deleted_at IS NULL AND p.role IN ('advisor','owner')) THEN RAISE EXCEPTION 'Assigned advisor unavailable'; END IF;
   -- Existing identity matches require deliberate linking, not a second invite/account.
   INSERT INTO public.recruit_records(full_name,email,phone,assigned_advisor_id,created_by)
   VALUES(btrim(p_payload->>'full_name'),lower(btrim(p_payload->>'email')),nullif(btrim(p_payload->>'phone'),''),linked,auth.uid()) RETURNING * INTO r;
   new_data:=to_jsonb(r);
 ELSE
   SELECT * INTO r FROM public.recruit_records WHERE id=p_recruit_id FOR UPDATE;
   IF r.id IS NULL THEN RAISE EXCEPTION 'Recruit not available'; END IF;
   IF p_revision IS NULL OR p_revision<>r.revision THEN RAISE EXCEPTION 'This recruit changed. Refresh before saving.'; END IF;
   IF r.is_archived AND p_action<>'edit' THEN RAISE EXCEPTION 'Restore the recruit before editing requirements'; END IF;
   IF p_action='edit' THEN
     PERFORM public.pp_assert_object_keys(p_payload,ARRAY['full_name','email','phone','assigned_advisor_id','advisor_profile_id','stage','next_action','next_action_due_on','is_archived']);
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
