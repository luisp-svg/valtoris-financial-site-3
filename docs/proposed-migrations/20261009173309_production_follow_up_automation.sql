-- Development pilot: opt-in case follow-up task automation. No historical backfill.
BEGIN;
ALTER TABLE public.tasks DROP CONSTRAINT tasks_workflow_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_workflow_type_check CHECK (workflow_type IS NULL OR workflow_type IN
 ('review_initial_diagnostic','resolve_possible_duplicate','review_digital_identity_lead','resolve_digital_identity_duplicate','production_follow_up'));
CREATE TABLE public.production_task_tracking (
 application_id uuid PRIMARY KEY REFERENCES public.policy_applications(id) ON DELETE CASCADE,
 assigned_user_id uuid NOT NULL REFERENCES public.profiles(id),
 enabled boolean NOT NULL DEFAULT true,
 task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 last_due_date date,
 configured_by uuid NOT NULL REFERENCES public.profiles(id),
 revision bigint NOT NULL DEFAULT 1,
 sync_error text
);
CREATE INDEX production_task_tracking_assignee_idx ON public.production_task_tracking(assigned_user_id);
CREATE INDEX production_task_tracking_task_idx ON public.production_task_tracking(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX production_task_tracking_configured_by_idx ON public.production_task_tracking(configured_by);
ALTER TABLE public.production_task_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_task_tracking FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.production_task_tracking TO authenticated;
CREATE POLICY production_task_tracking_read ON public.production_task_tracking FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)));

-- Private helpers: never exposed as RPCs. Definer needed to write managed tasks atomically.
CREATE SCHEMA IF NOT EXISTS crm_workflows;
REVOKE ALL ON SCHEMA crm_workflows FROM PUBLIC,anon,authenticated;
CREATE FUNCTION crm_workflows.sync_production_follow_up(p_application_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.policy_applications; b public.production_task_tracking; t public.tasks; v_task uuid; eligible boolean;
BEGIN
 SELECT * INTO a FROM public.policy_applications WHERE id=p_application_id;
 SELECT * INTO b FROM public.production_task_tracking WHERE application_id=p_application_id FOR UPDATE;
 IF NOT FOUND OR NOT b.enabled THEN RETURN; END IF;
 SELECT * INTO t FROM public.tasks WHERE id=b.task_id FOR UPDATE;
 IF a.deleted_at IS NOT NULL OR a.next_follow_up_date IS NULL OR a.production_stage::text IN ('in_force','declined','withdrawn','incomplete','not_taken') THEN
  IF t.deleted_at IS NULL AND t.status::text IN ('open','in_progress') THEN
   UPDATE public.tasks SET status='cancelled' WHERE id=t.id;
  END IF;
  UPDATE public.production_task_tracking SET sync_error=NULL WHERE application_id=a.id;
  RETURN;
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.households h ON h.id=a.household_id
  LEFT JOIN public.advisor_profiles ap ON ap.id=h.assigned_advisor_id AND ap.user_id=p.id
  WHERE p.id=b.assigned_user_id AND p.is_active AND p.deleted_at IS NULL
   AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
   AND (p.role='owner' OR (p.role='advisor' AND ap.id IS NOT NULL))) INTO eligible;
 IF NOT eligible THEN
  UPDATE public.production_task_tracking SET sync_error='Assignee no longer has access. Choose an active owner or the assigned household advisor.' WHERE application_id=a.id;
  RETURN;
 END IF;
 IF t.deleted_at IS NULL AND t.status::text IN ('open','in_progress') THEN
  UPDATE public.tasks SET due_date=a.next_follow_up_date,assigned_user_id=b.assigned_user_id,
   title='Production follow-up · '||replace(a.production_stage::text,'_',' ')
   WHERE id=t.id AND (due_date IS DISTINCT FROM a.next_follow_up_date OR assigned_user_id IS DISTINCT FROM b.assigned_user_id OR title IS DISTINCT FROM 'Production follow-up · '||replace(a.production_stage::text,'_',' '));
  v_task:=t.id;
 ELSIF t.deleted_at IS NULL AND t.status::text='done' AND b.last_due_date=a.next_follow_up_date THEN
  UPDATE public.production_task_tracking SET sync_error=NULL WHERE application_id=a.id;
  RETURN; -- Never reopen completed work or generate duplicates for unchanged dates.
 ELSE
  INSERT INTO public.tasks(household_id,opportunity_id,title,description,due_date,priority,status,assigned_user_id,created_by_user_id,source_type,workflow_type,metadata)
   VALUES(a.household_id,a.opportunity_id,'Production follow-up · '||replace(a.production_stage::text,'_',' '),
    'Review the case, complete the next action and record the outcome.',a.next_follow_up_date,'high','open',b.assigned_user_id,b.configured_by,'system','production_follow_up',jsonb_build_object('production_application_id',a.id)) RETURNING id INTO v_task;
  PERFORM public.crm_write_activity(a.household_id,'system','Production follow-up task created',NULL,
   jsonb_build_object('task_id',v_task,'application_id',a.id),a.opportunity_id,NULL,NULL,NULL);
 END IF;
 UPDATE public.production_task_tracking SET task_id=v_task,last_due_date=a.next_follow_up_date,sync_error=NULL WHERE application_id=a.id;
END $$;
REVOKE ALL ON FUNCTION crm_workflows.sync_production_follow_up(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION crm_workflows.production_follow_up_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM crm_workflows.sync_production_follow_up(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION crm_workflows.production_follow_up_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER production_follow_up_task_sync AFTER UPDATE OF next_follow_up_date,production_stage,deleted_at ON public.policy_applications
 FOR EACH ROW EXECUTE FUNCTION crm_workflows.production_follow_up_changed();

CREATE FUNCTION public.configure_production_task_tracking(p_application_id uuid,p_assigned_user_id uuid,p_enabled boolean,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.policy_applications; b public.production_task_tracking; actual_revision bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT public.crm_is_owner() THEN RAISE EXCEPTION 'FOLLOWUP:unavailable'; END IF;
 SELECT * INTO a FROM public.policy_applications WHERE id=p_application_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT public.crm_archive_access(a.household_id) OR NOT EXISTS(SELECT 1 FROM public.households WHERE id=a.household_id AND deleted_at IS NULL AND merged_into_household_id IS NULL) THEN RAISE EXCEPTION 'FOLLOWUP:unavailable'; END IF;
 SELECT * INTO b FROM public.production_task_tracking WHERE application_id=a.id FOR UPDATE;
 actual_revision:=COALESCE(b.revision,0);
 -- Retry of the same saved configuration is harmless.
 IF b.assigned_user_id=p_assigned_user_id AND b.enabled=p_enabled AND actual_revision=p_expected_revision+1 THEN
  RETURN to_jsonb(b);
 END IF;
 IF p_expected_revision IS NULL OR actual_revision<>p_expected_revision THEN RAISE EXCEPTION 'FOLLOWUP:conflict'; END IF;
 IF p_enabled IS NULL OR p_assigned_user_id IS NULL OR (p_enabled AND NOT EXISTS(SELECT 1 FROM public.profiles p LEFT JOIN public.households h ON h.id=a.household_id
  LEFT JOIN public.advisor_profiles ap ON ap.id=h.assigned_advisor_id AND ap.user_id=p.id
  WHERE p.id=p_assigned_user_id AND p.is_active AND p.deleted_at IS NULL AND (p.role='owner' OR (p.role='advisor' AND ap.id IS NOT NULL))) ) THEN RAISE EXCEPTION 'FOLLOWUP:invalid_assignee'; END IF;
 INSERT INTO public.production_task_tracking(application_id,assigned_user_id,enabled,configured_by,revision)
 VALUES(a.id,p_assigned_user_id,p_enabled,auth.uid(),1)
 ON CONFLICT(application_id) DO UPDATE SET assigned_user_id=excluded.assigned_user_id,enabled=excluded.enabled,configured_by=excluded.configured_by,revision=production_task_tracking.revision+1;
 PERFORM crm_workflows.sync_production_follow_up(a.id);
 PERFORM public.crm_write_activity(a.household_id,'system','Production task tracking configured',NULL,
  jsonb_build_object('application_id',a.id,'enabled',p_enabled,'assigned_user_id',p_assigned_user_id),a.opportunity_id,NULL,NULL,NULL);
 SELECT * INTO b FROM public.production_task_tracking WHERE application_id=a.id;
 RETURN to_jsonb(b);
END $$;
REVOKE ALL ON FUNCTION public.configure_production_task_tracking(uuid,uuid,boolean,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_production_task_tracking(uuid,uuid,boolean,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.act_on_crm_task(p_task_id uuid,p_expected_updated_at timestamptz,p_action text,p_due_date date DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE t public.tasks; hid uuid; old_due date; ts timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TASK:unavailable'; END IF;
 SELECT household_id INTO hid FROM public.tasks WHERE id=p_task_id AND deleted_at IS NULL;
 IF hid IS NULL OR NOT public.crm_archive_access(hid) THEN RAISE EXCEPTION 'TASK:unavailable'; END IF;
 PERFORM 1 FROM public.households WHERE id=hid AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK:unavailable'; END IF;
 SELECT * INTO t FROM public.tasks WHERE id=p_task_id AND household_id=hid AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT public.crm_archive_access(hid) THEN RAISE EXCEPTION 'TASK:unavailable'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('complete','reschedule') THEN RAISE EXCEPTION 'TASK:invalid_action'; END IF;
 IF (t.workflow_type IS NOT NULL AND t.workflow_type NOT IN ('review_initial_diagnostic','review_digital_identity_lead','production_follow_up')) OR t.source_type IS NULL OR t.source_type NOT IN ('manual','public_family_ingest','duplicate_resolution','system','digital_identity_ingest') THEN RAISE EXCEPTION 'TASK:workflow_required'; END IF;
 -- Unknown system work must stay in its originating workflow.
 IF t.workflow_type IS NULL AND t.source_type<>'manual' THEN RAISE EXCEPTION 'TASK:workflow_required'; END IF;
 IF t.workflow_type='production_follow_up' AND p_action='reschedule' THEN RAISE EXCEPTION 'TASK:reschedule_case'; END IF;
 IF p_action='complete' AND t.status='done' THEN RETURN jsonb_build_object('id',t.id,'status',t.status,'changed',false); END IF;
 IF t.status NOT IN ('open','in_progress') THEN RAISE EXCEPTION 'TASK:closed'; END IF;
 IF p_action='reschedule' THEN
  IF p_due_date IS NULL OR p_due_date<date '1900-01-01' OR p_due_date>date '2100-12-31' OR p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>500 THEN RAISE EXCEPTION 'TASK:invalid_schedule'; END IF;
  IF t.due_date=p_due_date THEN RETURN jsonb_build_object('id',t.id,'status',t.status,'changed',false); END IF;
 END IF;
 IF p_expected_updated_at IS NULL OR t.updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'TASK:conflict'; END IF;
 old_due:=t.due_date; ts:=clock_timestamp();
 IF p_action='complete' THEN
  UPDATE public.tasks SET status='done',completed_at=ts WHERE id=t.id;
 ELSE
  UPDATE public.tasks SET due_date=p_due_date WHERE id=t.id;
 END IF;
 PERFORM public.crm_write_activity(hid,'system',CASE WHEN p_action='complete' THEN 'Task completed' ELSE 'Task rescheduled' END,
  CASE WHEN p_action='reschedule' THEN btrim(p_reason) ELSE NULL END,
  jsonb_build_object('task_id',t.id,'action',p_action,'old_due_date',old_due,'new_due_date',CASE WHEN p_action='reschedule' THEN p_due_date ELSE old_due END,'previous_status',t.status),
  t.opportunity_id,NULL,t.lead_id,t.assessment_id);
 RETURN jsonb_build_object('id',t.id,'status',CASE WHEN p_action='complete' THEN 'done' ELSE t.status::text END,'changed',true);
END $$;
REVOKE ALL ON FUNCTION public.act_on_crm_task(uuid,timestamptz,text,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.act_on_crm_task(uuid,timestamptz,text,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
