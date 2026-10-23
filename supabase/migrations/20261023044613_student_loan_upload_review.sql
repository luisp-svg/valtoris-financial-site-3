-- Private student-loan evidence and automatic AI recommendations. No client delivery or application submission.
CREATE OR REPLACE FUNCTION public.student_loan_actor_can_access(p_actor uuid,p_household uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.households h ON h.id=p_household
 WHERE p.id=p_actor AND p.is_active AND p.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
 AND (p.role='owner' OR (p.role='advisor' AND EXISTS(
   SELECT 1 FROM public.advisor_profiles a WHERE a.user_id=p.id AND a.is_active AND a.deleted_at IS NULL
   AND (h.assigned_advisor_id=a.id OR EXISTS(SELECT 1 FROM public.leads l WHERE l.household_id=h.id
     AND l.assessment_type::text='student_loan' AND l.assigned_advisor_id=a.id AND l.deleted_at IS NULL AND l.status::text<>'archived'))))));
$$;
REVOKE ALL ON FUNCTION public.student_loan_actor_can_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_loan_actor_can_access(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.student_loan_can_access(p_household uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND public.student_loan_actor_can_access(auth.uid(),p_household);
$$;
REVOKE ALL ON FUNCTION public.student_loan_can_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_loan_can_access(uuid) TO authenticated;

CREATE TABLE public.student_loan_uploads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), household_id uuid NOT NULL REFERENCES public.households(id),
 case_id uuid REFERENCES public.service_production_records(id), uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 120),
 storage_path text NOT NULL UNIQUE, sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 524288), source_date date,
 authorization_reference text NOT NULL CHECK(length(btrim(authorization_reference)) BETWEEN 3 AND 300),
 inventory jsonb NOT NULL CHECK(jsonb_typeof(inventory)='object'), upload_complete boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(household_id,sha256)
);
CREATE TABLE public.student_loan_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),upload_id uuid NOT NULL REFERENCES public.student_loan_uploads(id),
 household_id uuid NOT NULL REFERENCES public.households(id),created_by uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'generating' CHECK(status IN('generating','ready','failed')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), model text, output jsonb,
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array'),
 final_text text NOT NULL DEFAULT '' CHECK(length(final_text)<=16000),
 intake_id uuid REFERENCES public.assessments(id),intake_updated_at timestamptz,
 failure_code text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'ready' OR (output IS NOT NULL AND model IS NOT NULL AND jsonb_array_length(sources)>0 AND length(btrim(final_text))>0))
);
CREATE UNIQUE INDEX student_loan_one_generation ON public.student_loan_reviews(upload_id) WHERE status='generating';
CREATE INDEX student_loan_upload_household ON public.student_loan_uploads(household_id,created_at DESC);
CREATE INDEX student_loan_review_household ON public.student_loan_reviews(household_id,created_at DESC);
CREATE TABLE public.student_loan_review_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),household_id uuid NOT NULL REFERENCES public.households(id),
 upload_id uuid REFERENCES public.student_loan_uploads(id),review_id uuid REFERENCES public.student_loan_reviews(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_loan_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_loan_uploads,public.student_loan_reviews,public.student_loan_review_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.student_loan_uploads,public.student_loan_reviews,public.student_loan_review_audit TO authenticated;
GRANT ALL ON public.student_loan_uploads,public.student_loan_reviews,public.student_loan_review_audit TO service_role;
CREATE POLICY student_loan_upload_read ON public.student_loan_uploads FOR SELECT TO authenticated USING(upload_complete AND public.student_loan_can_access(household_id));
CREATE POLICY student_loan_review_read ON public.student_loan_reviews FOR SELECT TO authenticated USING(public.student_loan_can_access(household_id));
CREATE POLICY student_loan_audit_read ON public.student_loan_review_audit FOR SELECT TO authenticated USING(public.student_loan_can_access(household_id));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('student-loan-data','student-loan-data',false,524288,ARRAY['text/plain'])
ON CONFLICT(id) DO NOTHING;
-- Objects are written only through the authenticated, permission-checked server. Clients cannot list the bucket.
CREATE POLICY student_loan_data_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='student-loan-data' AND EXISTS(SELECT 1 FROM public.student_loan_uploads u
 WHERE u.storage_path=name AND u.upload_complete AND public.student_loan_can_access(u.household_id)));

CREATE OR REPLACE FUNCTION public.student_loan_workspace()
RETURNS TABLE(household_id uuid,household_name text,latest_submission timestamptz,report_count bigint,upload_count bigint,pending_reviews bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT h.id,h.display_name,(SELECT max(l.submitted_at) FROM public.leads l WHERE l.household_id=h.id AND l.assessment_type::text='student_loan' AND l.deleted_at IS NULL),
 (SELECT count(*) FROM public.leads l WHERE l.household_id=h.id AND l.assessment_type::text='student_loan' AND l.deleted_at IS NULL),
 (SELECT count(*) FROM public.student_loan_uploads u WHERE u.household_id=h.id AND u.upload_complete),
 (SELECT count(*) FROM public.student_loan_reviews r WHERE r.household_id=h.id AND r.status='generating')
 FROM public.households h WHERE auth.uid() IS NOT NULL AND public.student_loan_can_access(h.id)
 AND (EXISTS(SELECT 1 FROM public.leads l WHERE l.household_id=h.id AND l.assessment_type::text='student_loan' AND l.deleted_at IS NULL)
 OR EXISTS(SELECT 1 FROM public.student_loan_uploads u WHERE u.household_id=h.id)
 OR EXISTS(SELECT 1 FROM public.service_production_records s WHERE s.household_id=h.id AND s.service_line='student_loans' AND s.deleted_at IS NULL))
 ORDER BY 3 DESC NULLS LAST,h.display_name LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.student_loan_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_loan_workspace() TO authenticated;

CREATE OR REPLACE FUNCTION public.student_loan_begin_review(p_actor uuid,p_upload uuid,p_intake uuid,p_intake_updated_at timestamptz)
RETURNS public.student_loan_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE u public.student_loan_uploads;r public.student_loan_reviews;
BEGIN
 SELECT * INTO u FROM public.student_loan_uploads WHERE id=p_upload AND upload_complete FOR UPDATE;
 IF u.id IS NULL OR NOT public.student_loan_actor_can_access(p_actor,u.household_id) THEN RAISE EXCEPTION 'SL:not_authorized'; END IF;
 IF p_intake IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.assessments a WHERE a.id=p_intake AND a.household_id=u.household_id AND a.assessment_type::text='student_loan_intake' AND a.deleted_at IS NULL AND a.updated_at=p_intake_updated_at) THEN RAISE EXCEPTION 'SL:intake_changed'; END IF;
 UPDATE public.student_loan_reviews SET status='failed',failure_code='generation_interrupted',updated_at=now(),revision=revision+1 WHERE upload_id=p_upload AND status='generating' AND created_at<now()-interval '5 minutes';
 IF EXISTS(SELECT 1 FROM public.student_loan_reviews WHERE upload_id=p_upload AND status='generating') THEN RAISE EXCEPTION 'SL:in_progress'; END IF;
 IF (SELECT count(*) FROM public.student_loan_reviews WHERE household_id=u.household_id AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'SL:daily_limit'; END IF;
 INSERT INTO public.student_loan_reviews(upload_id,household_id,created_by,intake_id,intake_updated_at)
 VALUES(u.id,u.household_id,p_actor,p_intake,p_intake_updated_at) RETURNING * INTO r;
 INSERT INTO public.student_loan_review_audit(household_id,upload_id,review_id,actor_id,action) VALUES(u.household_id,u.id,r.id,p_actor,'generation_requested');
 RETURN r;
END;$$;
REVOKE ALL ON FUNCTION public.student_loan_begin_review(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_loan_begin_review(uuid,uuid,uuid,timestamptz) TO service_role;


CREATE OR REPLACE FUNCTION public.student_loan_finish_upload(p_actor uuid,p_upload uuid)
RETURNS public.student_loan_uploads LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE u public.student_loan_uploads;
BEGIN
 SELECT * INTO u FROM public.student_loan_uploads WHERE id=p_upload FOR UPDATE;
 IF u.id IS NULL OR u.uploaded_by<>p_actor OR NOT public.student_loan_actor_can_access(p_actor,u.household_id) THEN RAISE EXCEPTION 'SL:not_authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='student-loan-data' AND name=u.storage_path) THEN RAISE EXCEPTION 'SL:upload_incomplete'; END IF;
 IF NOT u.upload_complete THEN
  UPDATE public.student_loan_uploads SET upload_complete=true WHERE id=u.id RETURNING * INTO u;
  INSERT INTO public.student_loan_review_audit(household_id,upload_id,actor_id,action) VALUES(u.household_id,u.id,p_actor,'aid_data_uploaded');
 END IF;
 RETURN u;
END;$$;
REVOKE ALL ON FUNCTION public.student_loan_finish_upload(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_loan_finish_upload(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.student_loan_finish_review(p_actor uuid,p_review uuid,p_output jsonb,p_sources jsonb,p_model text,p_text text)
RETURNS public.student_loan_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.student_loan_reviews;
BEGIN
 SELECT * INTO r FROM public.student_loan_reviews WHERE id=p_review FOR UPDATE;
 IF r.id IS NULL OR r.created_by<>p_actor OR NOT public.student_loan_actor_can_access(p_actor,r.household_id) THEN RAISE EXCEPTION 'SL:not_authorized'; END IF;
 IF r.status<>'generating' THEN RAISE EXCEPTION 'SL:conflict'; END IF;
 IF jsonb_typeof(p_output) IS DISTINCT FROM 'object' OR jsonb_typeof(p_sources) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sources)=0 OR p_model IS NULL OR length(p_model)>150 OR p_text IS NULL OR length(p_text)>16000 OR length(btrim(p_text))=0 THEN RAISE EXCEPTION 'SL:invalid_output'; END IF;
 UPDATE public.student_loan_reviews SET status='ready',output=p_output,sources=p_sources,model=p_model,final_text=p_text,revision=revision+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.student_loan_review_audit(household_id,upload_id,review_id,actor_id,action) VALUES(r.household_id,r.upload_id,r.id,p_actor,'ai_recommendations_generated');
 RETURN r;
END;$$;
REVOKE ALL ON FUNCTION public.student_loan_finish_review(uuid,uuid,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_loan_finish_review(uuid,uuid,jsonb,jsonb,text,text) TO service_role;
