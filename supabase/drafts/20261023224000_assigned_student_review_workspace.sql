-- Student Loans workspace includes explicitly assigned student reviews in combined submissions. No AI calls or communications are performed.
CREATE OR REPLACE FUNCTION public.student_loan_actor_can_access(p_actor uuid,p_household uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.households h ON h.id=p_household
 WHERE p.id=p_actor AND p.is_active AND p.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
 AND (p.role='owner' OR (p.role='advisor' AND EXISTS(
   SELECT 1 FROM public.advisor_profiles a WHERE a.user_id=p.id AND a.is_active AND a.deleted_at IS NULL
   AND (h.assigned_advisor_id=a.id OR EXISTS(SELECT 1 FROM public.leads l WHERE l.household_id=h.id
     AND l.assessment_type::text='student_loan' AND l.assigned_advisor_id=a.id AND l.deleted_at IS NULL AND l.status::text<>'archived') OR EXISTS(SELECT 1 FROM public.intake_review_assignments ra JOIN public.leads rl ON rl.id=ra.lead_id WHERE ra.review_type='student_loan' AND ra.advisor_id=a.id AND rl.household_id=h.id AND rl.deleted_at IS NULL AND rl.status::text<>'archived'))))));
$$;
REVOKE ALL ON FUNCTION public.student_loan_actor_can_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_loan_actor_can_access(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.student_loan_can_access(p_household uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND public.student_loan_actor_can_access(auth.uid(),p_household);
$$;
REVOKE ALL ON FUNCTION public.student_loan_can_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_loan_can_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_loan_workspace()
RETURNS TABLE(household_id uuid,household_name text,latest_submission timestamptz,report_count bigint,upload_count bigint,pending_reviews bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT h.id,h.display_name,(SELECT max(l.submitted_at) FROM public.leads l WHERE l.household_id=h.id AND (l.assessment_type::text='student_loan' OR EXISTS(SELECT 1 FROM public.intake_review_assignments ra WHERE ra.lead_id=l.id AND ra.review_type='student_loan')) AND l.deleted_at IS NULL),
 (SELECT count(*) FROM public.leads l WHERE l.household_id=h.id AND (l.assessment_type::text='student_loan' OR EXISTS(SELECT 1 FROM public.intake_review_assignments ra WHERE ra.lead_id=l.id AND ra.review_type='student_loan')) AND l.deleted_at IS NULL),
 (SELECT count(*) FROM public.student_loan_uploads u WHERE u.household_id=h.id AND u.upload_complete),
 (SELECT count(*) FROM public.student_loan_reviews r WHERE r.household_id=h.id AND r.status='generating')
 FROM public.households h WHERE auth.uid() IS NOT NULL AND public.student_loan_can_access(h.id)
 AND (EXISTS(SELECT 1 FROM public.leads l WHERE l.household_id=h.id AND (l.assessment_type::text='student_loan' OR EXISTS(SELECT 1 FROM public.intake_review_assignments ra WHERE ra.lead_id=l.id AND ra.review_type='student_loan')) AND l.deleted_at IS NULL)
 OR EXISTS(SELECT 1 FROM public.student_loan_uploads u WHERE u.household_id=h.id)
 OR EXISTS(SELECT 1 FROM public.service_production_records s WHERE s.household_id=h.id AND s.service_line='student_loans' AND s.deleted_at IS NULL))
 ORDER BY 3 DESC NULLS LAST,h.display_name LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.student_loan_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_loan_workspace() TO authenticated;
