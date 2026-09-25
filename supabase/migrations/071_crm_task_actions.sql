-- Explicitly approved task completion/rescheduling phase.
-- Block direct browser transitions while preserving existing SECURITY DEFINER automation.
CREATE FUNCTION public.guard_task_action_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND
   (NEW.status IS DISTINCT FROM OLD.status OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
  RAISE EXCEPTION 'TASK:use_action' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_task_action_columns() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tasks_guard_actions BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.guard_task_action_columns();

CREATE FUNCTION public.set_task_action_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond'); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.set_task_action_revision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_task_action_revision();

CREATE FUNCTION public.act_on_crm_task(p_task_id uuid,p_expected_updated_at timestamptz,p_action text,p_due_date date DEFAULT NULL,p_reason text DEFAULT NULL)
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
 IF (t.workflow_type IS NOT NULL AND t.workflow_type NOT IN ('review_initial_diagnostic','review_digital_identity_lead')) OR t.source_type IS NULL OR t.source_type NOT IN ('manual','public_family_ingest','duplicate_resolution','system','digital_identity_ingest') THEN RAISE EXCEPTION 'TASK:workflow_required'; END IF;
 -- Unknown system work must stay in its originating workflow.
 IF t.workflow_type IS NULL AND t.source_type<>'manual' THEN RAISE EXCEPTION 'TASK:workflow_required'; END IF;
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
