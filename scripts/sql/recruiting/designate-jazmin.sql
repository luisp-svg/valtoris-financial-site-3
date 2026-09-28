-- Run only as part of the authorized Phase 6 release, after migration 079.
-- This changes recruiting management only; never promotes a CRM role.
BEGIN;
DO $$
DECLARE target uuid; current_value jsonb;
BEGIN
 SELECT p.id INTO STRICT target FROM public.profiles p JOIN public.advisor_profiles a ON a.user_id=p.id
 WHERE p.id='2840bf8f-d81a-4c3f-9432-b0824679abc3' AND lower(p.email::text)='jazminp@valtorisfinancial.com'
   AND p.role='advisor' AND p.is_active AND p.deleted_at IS NULL AND a.is_active AND a.deleted_at IS NULL;
 SELECT value INTO STRICT current_value FROM public.app_settings WHERE key='recruiting_managers' FOR UPDATE;
 IF current_value NOT IN ('{"user_ids":[]}'::jsonb,jsonb_build_object('user_ids',jsonb_build_array(target::text))) THEN
   RAISE EXCEPTION 'Existing recruiting delegation needs review';
 END IF;
 UPDATE public.app_settings SET value=jsonb_build_object('user_ids',jsonb_build_array(target::text)),updated_at=now() WHERE key='recruiting_managers';
 INSERT INTO public.audit_logs(action,entity_table,after) VALUES('recruiting.designated_manager_authorized_release','app_settings',jsonb_build_object('setting','recruiting_managers','user_id',target));
END $$;
COMMIT;
