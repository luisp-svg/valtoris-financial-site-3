-- 013_storage_policies.sql
-- Private Supabase Storage bucket crm-documents + object RLS.
-- Assumptions (documented in supabase/README.md):
-- 1. Migration runs with privileges to write storage.buckets / storage.objects policies.
-- 2. App creates public.documents metadata FIRST, then uploads to the same storage_path.
-- 3. Object paths should be unguessable (e.g. {household_id}/{document_id}/{filename}).
-- 4. Clients use short-lived signed URLs from the API; do not make the bucket public.
-- 5. storage.objects RLS uses public.crm_* helpers (migration 010 must be applied first).

-- ---------------------------------------------------------------------------
-- Bucket: private, 20 MiB max
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('crm-documents', 'crm-documents', false, 20971520)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 20971520;

-- ---------------------------------------------------------------------------
-- storage.objects policies
-- Path must match an existing public.documents row (storage_bucket + storage_path).
-- Access requires owner OR crm_can_access_household(documents.household_id).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS crm_documents_storage_select ON storage.objects;
CREATE POLICY crm_documents_storage_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crm-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_bucket = bucket_id
        AND d.storage_path = name
        AND d.deleted_at IS NULL
        AND (
          public.crm_is_owner()
          OR (
            public.crm_can_access_household(d.household_id)
            AND d.visibility IN ('advisor_only', 'client_visible')
          )
        )
    )
  );

DROP POLICY IF EXISTS crm_documents_storage_insert ON storage.objects;
CREATE POLICY crm_documents_storage_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crm-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_bucket = bucket_id
        AND d.storage_path = name
        AND d.deleted_at IS NULL
        AND (
          public.crm_is_owner()
          OR (
            public.crm_can_access_household(d.household_id)
            AND d.visibility IN ('advisor_only', 'client_visible')
          )
        )
    )
  );

DROP POLICY IF EXISTS crm_documents_storage_update ON storage.objects;
CREATE POLICY crm_documents_storage_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'crm-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_bucket = bucket_id
        AND d.storage_path = name
        AND d.deleted_at IS NULL
        AND (public.crm_is_owner() OR public.crm_can_access_household(d.household_id))
    )
  )
  WITH CHECK (
    bucket_id = 'crm-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_bucket = bucket_id
        AND d.storage_path = name
        AND d.deleted_at IS NULL
        AND (public.crm_is_owner() OR public.crm_can_access_household(d.household_id))
    )
  );

DROP POLICY IF EXISTS crm_documents_storage_delete ON storage.objects;
CREATE POLICY crm_documents_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-documents'
    AND public.crm_is_owner()
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.storage_bucket = bucket_id
        AND d.storage_path = name
    )
  );

-- Explicitly no policies for anon → anon denied under Storage RLS.
