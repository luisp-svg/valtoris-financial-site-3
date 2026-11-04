-- LOCAL DRAFT ONLY. No messaging, scheduling, enrollment or provider triggers.
BEGIN;
CREATE TABLE public.tac_employer_benefits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id),
 opportunity_id uuid REFERENCES public.opportunities(id),
 source_assessment_id uuid REFERENCES public.assessments(id),
 company text NOT NULL CHECK(length(btrim(company)) BETWEEN 1 AND 200),
 divisions text[] NOT NULL DEFAULT '{}',
 decision_contact text, payroll_hr_contact text,
 owner_user_id uuid REFERENCES public.profiles(id),
 dcbg_reference text, report_answers jsonb NOT NULL DEFAULT '{}', review_date date, renewal_date date,
 total_employees integer CHECK(total_employees>=0), eligible_employees integer CHECK(eligible_employees>=0), enrolled_employees integer CHECK(enrolled_employees>=0),
 stage text NOT NULL DEFAULT 'prospect' CHECK(stage IN ('prospect','census','proposal','implementation','active','closed_lost','paused','disqualified')),
 outcome_reason text,
 next_action text, responsible_user_id uuid REFERENCES public.profiles(id), due_date date,
 stage_entered_at timestamptz NOT NULL DEFAULT now(), last_activity_at timestamptz NOT NULL DEFAULT now(), blockers text,
 checklist jsonb NOT NULL DEFAULT '{}', compensation_arrangement text,
 expected_monthly_cents bigint CHECK(expected_monthly_cents>=0), received_monthly_cents bigint CHECK(received_monthly_cents>=0), revenue_month date,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(eligible_employees IS NULL OR total_employees IS NULL OR eligible_employees<=total_employees),
 CHECK(enrolled_employees IS NULL OR eligible_employees IS NULL OR enrolled_employees<=eligible_employees),
 CHECK(enrolled_employees IS NULL OR total_employees IS NULL OR enrolled_employees<=total_employees),
 CHECK(stage NOT IN ('closed_lost','paused','disqualified') OR coalesce(length(btrim(outcome_reason)),0)>0),
 CHECK((expected_monthly_cents IS NULL AND received_monthly_cents IS NULL) OR coalesce(length(btrim(compensation_arrangement)),0)>0),
 UNIQUE(household_id,opportunity_id)
);
CREATE UNIQUE INDEX tac_employer_one_unlinked ON public.tac_employer_benefits(household_id,lower(btrim(company))) WHERE opportunity_id IS NULL;
CREATE TABLE public.tac_application_actions (
 application_id uuid PRIMARY KEY REFERENCES public.policy_applications(id),
 responsible_user_id uuid REFERENCES public.profiles(id),
 waiting_on text CHECK(waiting_on IN ('client','carrier','internal')),
 next_action text, due_date date, unresolved_update boolean NOT NULL DEFAULT false,
 last_verified_at timestamptz, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tac_policy_reviews (
 application_id uuid PRIMARY KEY REFERENCES public.policy_applications(id),
 business_relationship text, delivered_date date, anniversary_date date, annual_review_date date, beneficiary_review_due date,
 funding_status text CHECK(funding_status IN ('unknown','requested','in_transfer','partially_received','received','verified')),
 expected_funding_cents bigint CHECK(expected_funding_cents>=0), received_funding_cents bigint CHECK(received_funding_cents>=0),
 surrender_terms text, surrender_verified_at date, contract_deadline date, deadline_action text,
 source_system text, source_record_id text, partner_record_url text, last_imported_at timestamptz, last_verified_at timestamptz,
 related_application_id uuid REFERENCES public.policy_applications(id), relationship text CHECK(relationship IN ('related','potential_duplicate','supersedes','superseded_by')),
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(related_application_id IS NULL OR related_application_id<>application_id),
 CHECK(surrender_terms IS NULL OR surrender_verified_at IS NOT NULL),
 CHECK(partner_record_url IS NULL OR partner_record_url ~ '^https://[^/@ ]+(/|$)'),
 CHECK((related_application_id IS NULL)=(relationship IS NULL))
);
CREATE UNIQUE INDEX tac_policy_partner_identity ON public.tac_policy_reviews(source_system,source_record_id) WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;
-- Concurrency guard: every edit must advance the revision; stage clocks are server-controlled.
CREATE FUNCTION public.tac_review_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='tac_employer_benefits' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.household_id IS DISTINCT FROM OLD.household_id THEN RAISE EXCEPTION 'TAC:immutable_identity'; END IF;
  ELSE
   IF NEW.application_id IS DISTINCT FROM OLD.application_id THEN RAISE EXCEPTION 'TAC:immutable_identity'; END IF;
  END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'TAC:stale_record'; END IF;
  NEW.updated_at:=now();
  IF TG_TABLE_NAME='tac_employer_benefits' THEN
   NEW.stage_entered_at:=CASE WHEN NEW.stage IS DISTINCT FROM OLD.stage THEN now() ELSE OLD.stage_entered_at END;
   NEW.last_activity_at:=now();
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tac_review_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tac_employer_revision BEFORE UPDATE ON public.tac_employer_benefits FOR EACH ROW EXECUTE FUNCTION public.tac_review_revision();
CREATE TRIGGER tac_actions_revision BEFORE UPDATE ON public.tac_application_actions FOR EACH ROW EXECUTE FUNCTION public.tac_review_revision();
CREATE TRIGGER tac_policy_revision BEFORE UPDATE ON public.tac_policy_reviews FOR EACH ROW EXECUTE FUNCTION public.tac_review_revision();
ALTER TABLE public.tac_employer_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tac_application_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tac_policy_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tac_employer_benefits,public.tac_application_actions,public.tac_policy_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.tac_employer_benefits,public.tac_application_actions,public.tac_policy_reviews TO authenticated;
CREATE POLICY tac_employer_read ON public.tac_employer_benefits FOR SELECT TO authenticated USING(public.crm_can_access_household(household_id) AND (opportunity_id IS NULL OR public.crm_can_access_opportunity(opportunity_id)));
CREATE POLICY tac_employer_insert ON public.tac_employer_benefits FOR INSERT TO authenticated WITH CHECK(public.crm_is_owner() AND public.crm_can_access_household(household_id) AND (source_assessment_id IS NULL OR EXISTS(SELECT 1 FROM public.assessments s WHERE s.id=source_assessment_id AND s.household_id=tac_employer_benefits.household_id)) AND (opportunity_id IS NULL OR EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id=opportunity_id AND o.household_id=tac_employer_benefits.household_id AND public.crm_can_access_opportunity(o.id))));
CREATE POLICY tac_employer_update ON public.tac_employer_benefits FOR UPDATE TO authenticated USING(public.crm_is_owner()) WITH CHECK(public.crm_is_owner() AND public.crm_can_access_household(household_id) AND (source_assessment_id IS NULL OR EXISTS(SELECT 1 FROM public.assessments s WHERE s.id=source_assessment_id AND s.household_id=tac_employer_benefits.household_id)) AND (opportunity_id IS NULL OR EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id=opportunity_id AND o.household_id=tac_employer_benefits.household_id AND public.crm_can_access_opportunity(o.id))));
CREATE POLICY tac_action_read ON public.tac_application_actions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)));
CREATE POLICY tac_action_insert ON public.tac_application_actions FOR INSERT TO authenticated WITH CHECK(public.crm_is_owner() AND EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)));
CREATE POLICY tac_action_update ON public.tac_application_actions FOR UPDATE TO authenticated USING(public.crm_is_owner()) WITH CHECK(public.crm_is_owner() AND EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)));
CREATE POLICY tac_policy_read ON public.tac_policy_reviews FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)));
CREATE POLICY tac_policy_insert ON public.tac_policy_reviews FOR INSERT TO authenticated WITH CHECK(public.crm_is_owner() AND EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)) AND (related_application_id IS NULL OR EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=related_application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))));
CREATE POLICY tac_policy_update ON public.tac_policy_reviews FOR UPDATE TO authenticated USING(public.crm_is_owner()) WITH CHECK(public.crm_is_owner() AND EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id)) AND (related_application_id IS NULL OR EXISTS(SELECT 1 FROM public.policy_applications a WHERE a.id=related_application_id AND a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))));
-- Append-only audit. Trigger runs privately and rechecks active owner authorization.
CREATE TABLE public.tac_review_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 household_id uuid NOT NULL REFERENCES public.households(id),
 record_table text NOT NULL, record_id uuid NOT NULL, actor_id uuid NOT NULL,
 before_record jsonb, after_record jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tac_review_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tac_review_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tac_review_history TO authenticated;
CREATE POLICY tac_history_read ON public.tac_review_history FOR SELECT TO authenticated USING(public.crm_can_access_household(household_id));
CREATE SCHEMA IF NOT EXISTS tac_private;
REVOKE ALL ON SCHEMA tac_private FROM PUBLIC,anon,authenticated;
CREATE FUNCTION tac_private.audit_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE h uuid; k uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.crm_is_owner() THEN RAISE EXCEPTION 'TAC:owner_required'; END IF;
 IF TG_TABLE_NAME='tac_employer_benefits' THEN h:=NEW.household_id; k:=NEW.id;
 ELSE SELECT household_id INTO h FROM public.policy_applications WHERE id=NEW.application_id AND deleted_at IS NULL; k:=NEW.application_id; END IF;
 IF h IS NULL OR NOT public.crm_can_access_household(h) THEN RAISE EXCEPTION 'TAC:not_available'; END IF;
 INSERT INTO public.tac_review_history(household_id,record_table,record_id,actor_id,before_record,after_record)
 VALUES(h,TG_TABLE_NAME,k,auth.uid(),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tac_private.audit_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tac_employer_audit AFTER INSERT OR UPDATE ON public.tac_employer_benefits FOR EACH ROW EXECUTE FUNCTION tac_private.audit_review();
CREATE TRIGGER tac_action_audit AFTER INSERT OR UPDATE ON public.tac_application_actions FOR EACH ROW EXECUTE FUNCTION tac_private.audit_review();
CREATE TRIGGER tac_policy_audit AFTER INSERT OR UPDATE ON public.tac_policy_reviews FOR EACH ROW EXECUTE FUNCTION tac_private.audit_review();
COMMIT;
