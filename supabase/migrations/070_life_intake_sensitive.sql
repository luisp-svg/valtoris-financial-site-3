-- Explicitly approved encrypted, person-specific Life intake. Encryption keys stay outside Postgres.
CREATE TABLE public.life_intake_sensitive_records (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 intake_id uuid NOT NULL REFERENCES public.assessments(id),
 household_id uuid NOT NULL REFERENCES public.households(id),
 insured_member_id uuid NOT NULL REFERENCES public.household_members(id),
 ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 40 AND 70000),
 key_version text NOT NULL CHECK(key_version='v1'),
 ssn_present boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),
 UNIQUE(intake_id,insured_member_id)
);
ALTER TABLE public.life_intake_sensitive_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_intake_sensitive_records FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.authorize_life_intake_sensitive(p_actor uuid,p_intake uuid,p_member uuid)
RETURNS public.assessments LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.assessments; h public.households;
BEGIN
 SELECT * INTO a FROM public.assessments WHERE id=p_intake;
 IF NOT FOUND OR a.assessment_type<>'life_insurance_intake' OR a.capture_channel<>'advisor_onboarding' OR a.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'SENSITIVE:unavailable'; END IF;
 SELECT * INTO h FROM public.households WHERE id=a.household_id FOR SHARE;
 IF NOT FOUND OR h.deleted_at IS NOT NULL OR h.merged_into_household_id IS NOT NULL THEN RAISE EXCEPTION 'SENSITIVE:unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND p.is_active AND p.deleted_at IS NULL AND (p.role='owner' OR (p.role='advisor' AND EXISTS(SELECT 1 FROM public.advisor_profiles ap WHERE ap.user_id=p.id AND ap.id=h.assigned_advisor_id AND ap.is_active AND ap.deleted_at IS NULL)))) THEN RAISE EXCEPTION 'SENSITIVE:unavailable'; END IF;
 PERFORM 1 FROM public.household_members WHERE id=p_member AND household_id=h.id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SENSITIVE:unavailable'; END IF;
 SELECT * INTO a FROM public.assessments WHERE id=p_intake FOR UPDATE;
 IF a.deleted_at IS NOT NULL OR a.household_id<>h.id OR a.assessment_type<>'life_insurance_intake' THEN RAISE EXCEPTION 'SENSITIVE:unavailable'; END IF;
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION public.authorize_life_intake_sensitive(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.read_life_intake_sensitive(p_actor uuid,p_intake uuid,p_member uuid,p_reveal boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.assessments; r public.life_intake_sensitive_records;
BEGIN
 a:=public.authorize_life_intake_sensitive(p_actor,p_intake,p_member);
 SELECT * INTO r FROM public.life_intake_sensitive_records WHERE intake_id=p_intake AND insured_member_id=p_member;
 IF NOT FOUND THEN RETURN jsonb_build_object('exists',false,'intake_id',p_intake,'member_id',p_member); END IF;
 IF p_reveal THEN
  INSERT INTO public.activities(household_id,assessment_id,actor_user_id,activity_type,title,metadata) VALUES(a.household_id,a.id,p_actor,'system','Protected Life intake opened',jsonb_build_object('sensitive_record_id',r.id,'insured_member_id',p_member));
 END IF;
 RETURN jsonb_build_object('exists',true,'intake_id',p_intake,'member_id',p_member,'updated_at',r.updated_at,'ssn_present',r.ssn_present,'key_version',r.key_version)||CASE WHEN p_reveal THEN jsonb_build_object('ciphertext',r.ciphertext) ELSE '{}'::jsonb END;
END $$;
CREATE OR REPLACE FUNCTION public.save_life_intake_sensitive(p_actor uuid,p_intake uuid,p_member uuid,p_expected_updated_at timestamptz,p_ciphertext text,p_ssn_present boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.assessments; r public.life_intake_sensitive_records;
BEGIN
 a:=public.authorize_life_intake_sensitive(p_actor,p_intake,p_member);
 IF a.status<>'draft' THEN RAISE EXCEPTION 'SENSITIVE:preserved_record'; END IF;
 IF p_ciphertext IS NULL OR length(p_ciphertext) NOT BETWEEN 40 AND 70000 OR p_ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$' OR p_ssn_present IS NULL THEN RAISE EXCEPTION 'SENSITIVE:invalid_payload'; END IF;
 SELECT * INTO r FROM public.life_intake_sensitive_records WHERE intake_id=p_intake AND insured_member_id=p_member FOR UPDATE;
 IF (FOUND AND (p_expected_updated_at IS NULL OR r.updated_at<>p_expected_updated_at)) OR (NOT FOUND AND p_expected_updated_at IS NOT NULL) THEN RAISE EXCEPTION 'SENSITIVE:conflict'; END IF;
 INSERT INTO public.life_intake_sensitive_records(intake_id,household_id,insured_member_id,ciphertext,key_version,ssn_present,updated_by)
 VALUES(p_intake,a.household_id,p_member,p_ciphertext,'v1',p_ssn_present,p_actor)
 ON CONFLICT(intake_id,insured_member_id) DO UPDATE SET ciphertext=excluded.ciphertext,ssn_present=excluded.ssn_present,updated_by=p_actor,updated_at=greatest(clock_timestamp(),public.life_intake_sensitive_records.updated_at+interval '1 microsecond') RETURNING * INTO r;
 INSERT INTO public.activities(household_id,assessment_id,actor_user_id,activity_type,title,metadata) VALUES(a.household_id,a.id,p_actor,'system','Protected Life intake saved',jsonb_build_object('sensitive_record_id',r.id,'insured_member_id',p_member));
 RETURN jsonb_build_object('exists',true,'intake_id',p_intake,'member_id',p_member,'updated_at',r.updated_at,'ssn_present',r.ssn_present,'key_version',r.key_version);
END $$;
REVOKE ALL ON FUNCTION public.read_life_intake_sensitive(uuid,uuid,uuid,boolean),public.save_life_intake_sensitive(uuid,uuid,uuid,timestamptz,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_life_intake_sensitive(uuid,uuid,uuid,boolean),public.save_life_intake_sensitive(uuid,uuid,uuid,timestamptz,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
