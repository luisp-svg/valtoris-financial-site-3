-- 009_documents_portal.sql
-- Document metadata + future client portal accounts.
-- Storage bucket crm-documents is configured in Supabase Dashboard / storage API (see README).
-- Max upload size for V1 app layer: 20 MB (enforce in API/UI; Storage also configurable).

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.policies (id) ON DELETE SET NULL,
  uploaded_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'crm-documents',
  storage_path text NOT NULL,
  mime_type text,
  byte_size bigint,
  visibility public.document_visibility NOT NULL DEFAULT 'advisor_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT documents_byte_size_nonnegative CHECK (byte_size IS NULL OR byte_size >= 0),
  -- App enforces 20 MB; DB guard rails at 20 MiB
  CONSTRAINT documents_byte_size_max_v1 CHECK (byte_size IS NULL OR byte_size <= 20971520),
  CONSTRAINT documents_storage_path_unique UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS documents_household_idx
  ON public.documents (household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_opportunity_idx
  ON public.documents (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_visibility_idx
  ON public.documents (visibility)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.documents IS
  'Metadata for files in private Supabase Storage bucket crm-documents. Max 20 MB V1.';
COMMENT ON COLUMN public.documents.storage_path IS
  'Object path inside bucket; use random UUID prefixes — never guessable household ids alone.';

-- ---------------------------------------------------------------------------
-- client_portal_accounts (schema for future portal; no portal UI in V1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_portal_accounts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  invited_at timestamptz,
  accepted_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS client_portal_accounts_household_idx
  ON public.client_portal_accounts (household_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS client_portal_accounts_set_updated_at ON public.client_portal_accounts;
CREATE TRIGGER client_portal_accounts_set_updated_at
  BEFORE UPDATE ON public.client_portal_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.client_portal_accounts IS
  'Future client portal linkage to household. Reserved role=client; no portal UI in V1.';

-- Storage bucket is created and secured in 013_storage_policies.sql.
-- Do not uncomment ad-hoc bucket inserts here.
