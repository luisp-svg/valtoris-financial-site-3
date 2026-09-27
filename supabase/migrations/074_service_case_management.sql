-- Approved Phase 2: additive service case work; no historical backfill.
BEGIN;
ALTER TABLE public.service_production_records
 ADD COLUMN case_owner_user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 ADD COLUMN next_follow_up_date date,
 ADD COLUMN case_stage text CHECK(case_stage IN ('queued','in_progress','waiting_client','waiting_provider','ready_to_complete')),
 ADD COLUMN case_stage_changed_at timestamptz,
 ADD COLUMN waiting_reason text CHECK(waiting_reason IS NULL OR (waiting_reason=btrim(waiting_reason) AND length(waiting_reason) BETWEEN 1 AND 500)),
 ADD CONSTRAINT service_case_waiting_reason CHECK(case_stage NOT IN ('waiting_client','waiting_provider') OR waiting_reason IS NOT NULL);
CREATE INDEX service_case_follow_up ON public.service_production_records(next_follow_up_date,id) WHERE deleted_at IS NULL AND production_status='submitted';
CREATE INDEX service_case_owner ON public.service_production_records(case_owner_user_id,case_stage) WHERE deleted_at IS NULL;

CREATE TABLE public.service_production_requirements (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 record_id uuid NOT NULL REFERENCES public.service_production_records(id) ON DELETE RESTRICT,
 label text NOT NULL CHECK(label=btrim(label) AND length(label) BETWEEN 1 AND 120),
 status text NOT NULL CHECK(status IN ('open','scheduled','complete','waived','cancelled')),
 is_blocking boolean NOT NULL DEFAULT true,
 assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 due_date date, scheduled_for date,
 completed_at timestamptz, waived_at timestamptz,
 revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CHECK(status<>'scheduled' OR scheduled_for IS NOT NULL),
 CHECK((status='complete')=(completed_at IS NOT NULL)),
 CHECK((status='waived')=(waived_at IS NOT NULL))
);
CREATE INDEX service_requirement_record ON public.service_production_requirements(record_id,created_at,id);
CREATE INDEX service_requirement_due ON public.service_production_requirements(due_date,record_id) WHERE deleted_at IS NULL AND status IN ('open','scheduled');
ALTER TABLE public.service_production_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_requirement_read ON public.service_production_requirements FOR SELECT TO authenticated USING(public.sp_can_access(record_id) AND (deleted_at IS NULL OR public.crm_is_owner()));
REVOKE ALL ON public.service_production_requirements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.service_production_requirements TO authenticated;
GRANT ALL ON public.service_production_requirements TO service_role;
ALTER TABLE public.service_production_history DROP CONSTRAINT service_production_history_event_type_check;
ALTER TABLE public.service_production_history ADD CONSTRAINT service_production_history_event_type_check CHECK(event_type IN ('created','updated','allocations_changed','estimate_reviewed','archived','case_updated','requirement_created','requirement_updated'));

-- Mirrors the existing owner/current-household-advisor access rule. Assignment
-- is responsibility only: sp_can_access never consults these operational fields.
CREATE FUNCTION public.sp_user_eligible(p_record uuid,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.service_production_records r ON r.id=p_record JOIN public.households h ON h.id=r.household_id
 WHERE p.id=p_user AND p.is_active AND p.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
 AND (p.role='owner' OR (p.role='advisor' AND EXISTS(SELECT 1 FROM public.advisor_profiles a WHERE a.user_id=p.id AND a.id=h.assigned_advisor_id AND a.is_active AND a.deleted_at IS NULL))));
$$;
REVOKE ALL ON FUNCTION public.sp_user_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.service_case_assignees(p_record uuid) RETURNS TABLE(id uuid,display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
 SELECT p.id,coalesce(nullif(p.full_name,''),'CRM user') FROM public.profiles p WHERE public.sp_can_access(p_record) AND public.sp_user_eligible(p_record,p.id) ORDER BY p.full_name,p.id;
$$;
REVOKE ALL ON FUNCTION public.service_case_assignees(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_case_assignees(uuid) TO authenticated;

CREATE FUNCTION public.sp_case_completion_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
BEGIN
 IF OLD.production_status IN ('completed','cancelled') AND NEW.production_status IS DISTINCT FROM OLD.production_status AND NOT public.crm_is_owner() AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'CRM_SP:owner_reopen_required'; END IF;
 IF (NEW.production_status='completed' OR NEW.case_stage='ready_to_complete') AND EXISTS(SELECT 1 FROM public.service_production_requirements q WHERE q.record_id=NEW.id AND q.deleted_at IS NULL AND q.is_blocking AND q.status IN ('open','scheduled')) THEN RAISE EXCEPTION 'CRM_SP:blocking_requirements'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER service_case_completion BEFORE UPDATE OF production_status,case_stage ON public.service_production_records FOR EACH ROW EXECUTE FUNCTION public.sp_case_completion_guard();
REVOKE ALL ON FUNCTION public.sp_case_completion_guard() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.update_service_case(p_id uuid,p_revision integer,p_fields jsonb,p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE r public.service_production_records; n public.service_production_records; u uuid; stage text;
BEGIN
 IF NOT public.sp_can_access(p_id) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 PERFORM public.pp_assert_payload_size(p_fields);
 PERFORM public.pp_assert_object_keys(p_fields,ARRAY['case_owner_user_id','next_follow_up_date','case_stage','waiting_reason']);
 SELECT * INTO r FROM public.service_production_records WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
 IF r.production_status<>'submitted' THEN RAISE EXCEPTION 'CRM_SP:case_not_active'; END IF;
 u:=(p_fields->>'case_owner_user_id')::uuid; stage:=p_fields->>'case_stage';
 IF stage IS NULL THEN RAISE EXCEPTION 'CRM_SP:invalid_case_stage'; END IF;
 IF u IS DISTINCT FROM r.case_owner_user_id AND NOT public.crm_is_owner() THEN RAISE EXCEPTION 'CRM_SP:owner_assignment_required'; END IF;
 IF u IS NOT NULL AND NOT public.sp_user_eligible(p_id,u) THEN RAISE EXCEPTION 'CRM_SP:ineligible_assignee'; END IF;
 UPDATE public.service_production_records SET case_owner_user_id=u,next_follow_up_date=(p_fields->>'next_follow_up_date')::date,case_stage=stage,
 case_stage_changed_at=CASE WHEN case_stage IS DISTINCT FROM stage THEN now() ELSE case_stage_changed_at END,
 waiting_reason=CASE WHEN stage IN ('waiting_client','waiting_provider') THEN nullif(btrim(p_fields->>'waiting_reason'),'') ELSE NULL END,
 revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO n;
 INSERT INTO public.service_production_history(record_id,actor_id,event_type,changes,reason) VALUES(p_id,auth.uid(),'case_updated',jsonb_build_object('before',jsonb_build_object('owner',r.case_owner_user_id,'stage',r.case_stage,'follow_up',r.next_follow_up_date,'waiting_reason',r.waiting_reason),'after',p_fields),p_reason);
 RETURN n.revision;
END; $$;
REVOKE ALL ON FUNCTION public.update_service_case(uuid,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_service_case(uuid,integer,jsonb,text) TO authenticated;

-- Parent revision serializes requirements against case completion/archive. The
-- client-generated UUID makes create retries safe, even after an uncertain reply.
CREATE FUNCTION public.save_service_requirement(p_record uuid,p_record_revision integer,p_id uuid,p_revision integer,p_fields jsonb,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE r public.service_production_records; q public.service_production_requirements; n public.service_production_requirements; u uuid; st text;
BEGIN
 IF NOT public.sp_can_access(p_record) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 PERFORM public.pp_assert_payload_size(p_fields);
 PERFORM public.pp_assert_object_keys(p_fields,ARRAY['label','status','is_blocking','assigned_user_id','due_date','scheduled_for']);
 SELECT * INTO r FROM public.service_production_records WHERE id=p_record AND deleted_at IS NULL FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 SELECT * INTO q FROM public.service_production_requirements WHERE id=p_id;
 IF q.id IS NOT NULL AND q.record_id<>p_record THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 IF p_revision IS NULL AND q.id IS NOT NULL THEN
  IF q.created_by=auth.uid() AND q.deleted_at IS NULL THEN RETURN q.id; END IF;
  RAISE EXCEPTION 'CRM_SP:not_found';
 END IF;
 IF r.revision IS DISTINCT FROM p_record_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
 IF r.production_status<>'submitted' THEN RAISE EXCEPTION 'CRM_SP:case_not_active'; END IF;
 IF p_revision IS NOT NULL AND (q.id IS NULL OR q.deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'CRM_SP:not_found'; END IF;
 IF q.id IS NOT NULL AND q.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CRM_SP:stale_record'; END IF;
 st:=p_fields->>'status'; u:=(p_fields->>'assigned_user_id')::uuid;
 IF q.id IS NULL AND st NOT IN ('open','scheduled') THEN RAISE EXCEPTION 'CRM_SP:invalid_requirement_transition'; END IF;
 IF q.status='cancelled' AND st<>'cancelled' THEN RAISE EXCEPTION 'CRM_SP:invalid_requirement_transition'; END IF;
 IF q.status IN ('complete','waived') AND st IS DISTINCT FROM q.status AND st<>'open' THEN RAISE EXCEPTION 'CRM_SP:invalid_requirement_transition'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'CRM_SP:reason_required'; END IF;
 IF u IS NOT NULL AND NOT public.sp_user_eligible(p_record,u) THEN RAISE EXCEPTION 'CRM_SP:ineligible_assignee'; END IF;
 IF NOT public.crm_is_owner() AND u IS DISTINCT FROM q.assigned_user_id AND u IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'CRM_SP:owner_assignment_required'; END IF;
 IF r.case_stage='ready_to_complete' AND (p_fields->>'is_blocking')::boolean AND st IN ('open','scheduled') THEN RAISE EXCEPTION 'CRM_SP:ready_case_blocker'; END IF;
 IF q.id IS NULL THEN
  INSERT INTO public.service_production_requirements(id,record_id,label,status,is_blocking,assigned_user_id,due_date,scheduled_for,created_by,updated_by)
  VALUES(p_id,p_record,btrim(p_fields->>'label'),st,(p_fields->>'is_blocking')::boolean,u,(p_fields->>'due_date')::date,(p_fields->>'scheduled_for')::date,auth.uid(),auth.uid()) RETURNING * INTO n;
 ELSE
  UPDATE public.service_production_requirements SET label=btrim(p_fields->>'label'),status=st,is_blocking=(p_fields->>'is_blocking')::boolean,assigned_user_id=u,
  due_date=(p_fields->>'due_date')::date,scheduled_for=(p_fields->>'scheduled_for')::date,
  completed_at=CASE WHEN st='complete' THEN coalesce(completed_at,now()) END,waived_at=CASE WHEN st='waived' THEN coalesce(waived_at,now()) END,
  revision=revision+1,updated_by=auth.uid(),updated_at=now() WHERE id=p_id RETURNING * INTO n;
 END IF;
 UPDATE public.service_production_records SET revision=revision+1,updated_at=now() WHERE id=p_record;
 INSERT INTO public.service_production_history(record_id,actor_id,event_type,changes,reason) VALUES(p_record,auth.uid(),CASE WHEN q.id IS NULL THEN 'requirement_created' ELSE 'requirement_updated' END,jsonb_build_object('requirement_id',p_id,'before',to_jsonb(q),'after',to_jsonb(n)),btrim(p_reason));
 RETURN n.id;
END; $$;
REVOKE ALL ON FUNCTION public.save_service_requirement(uuid,integer,uuid,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_requirement(uuid,integer,uuid,integer,jsonb,text) TO authenticated;
COMMIT;
