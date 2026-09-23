-- 055_integration_contact_links.sql
-- Durable provider-neutral map from one household member to one external
-- contact in one provider location.
--
-- This table records an established identity relationship only.
-- It is not a sync-attempt log, an outbox, or a credential store.
--
-- household_members are removed from advisor view by setting deleted_at
-- (soft_delete_household_member). That update does not delete the member
-- row, so this link remains. ON DELETE RESTRICT blocks a later hard DELETE
-- of a mapped member — including a household hard delete that would cascade
-- to that member — so the external identity cannot disappear and be created
-- again as a second contact.

-- ---------------------------------------------------------------------------
-- integration_contact_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_contact_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  provider text NOT NULL,
  location_id text NOT NULL,
  external_contact_id text NOT NULL,
  household_member_id uuid NOT NULL REFERENCES public.household_members (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_contact_links_provider_check
    CHECK (
      char_length(provider) BETWEEN 1 AND 64
      AND provider = btrim(provider)
    ),
  CONSTRAINT integration_contact_links_location_id_check
    CHECK (
      char_length(location_id) BETWEEN 1 AND 128
      AND location_id = btrim(location_id)
    ),
  CONSTRAINT integration_contact_links_external_contact_id_check
    CHECK (
      char_length(external_contact_id) BETWEEN 1 AND 128
      AND external_contact_id = btrim(external_contact_id)
    ),
  CONSTRAINT integration_contact_links_contact_unique
    UNIQUE (provider, location_id, external_contact_id),
  CONSTRAINT integration_contact_links_member_unique
    UNIQUE (provider, location_id, household_member_id)
);

CREATE INDEX IF NOT EXISTS integration_contact_links_member_idx
  ON public.integration_contact_links (household_member_id);

DROP TRIGGER IF EXISTS integration_contact_links_set_updated_at ON public.integration_contact_links;
CREATE TRIGGER integration_contact_links_set_updated_at
  BEFORE UPDATE ON public.integration_contact_links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.integration_contact_links IS
  'Durable map from one household member to one external contact for one provider and location. Not a sync log. Soft-deleted members keep the row. Hard delete of a mapped member is restricted.';
COMMENT ON COLUMN public.integration_contact_links.provider IS
  'Provider key. Free text so a later integration can use the same table. Not an enum.';
COMMENT ON COLUMN public.integration_contact_links.location_id IS
  'Provider account or location scope. Not a credential.';
COMMENT ON COLUMN public.integration_contact_links.external_contact_id IS
  'Provider contact id within location_id. Not phone, email, or a name.';
COMMENT ON COLUMN public.integration_contact_links.household_member_id IS
  'The Valtoris person. One member maps to one external contact per provider and location.';

-- ---------------------------------------------------------------------------
-- RLS
-- Advisors read a link only when household_members_select would already
-- show that member: the member is not soft-deleted, and
-- crm_can_access_household allows the caller (owner, or assigned advisor).
-- No INSERT, UPDATE, or DELETE policy. Authenticated and anon clients
-- cannot write. service_role bypasses RLS and is the future writer.
-- ---------------------------------------------------------------------------
ALTER TABLE public.integration_contact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_contact_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_contact_links_select ON public.integration_contact_links;
CREATE POLICY integration_contact_links_select ON public.integration_contact_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members m
      WHERE m.id = integration_contact_links.household_member_id
        AND m.deleted_at IS NULL
        AND public.crm_can_access_household(m.household_id)
    )
  );

COMMENT ON POLICY integration_contact_links_select ON public.integration_contact_links IS
  'Read only when the caller can already see the live household member. No client write policy.';

-- Supabase default privileges grant ALL on new public tables to anon and
-- authenticated. These REVOKEs are load-bearing.
REVOKE ALL ON TABLE public.integration_contact_links FROM PUBLIC;
REVOKE ALL ON TABLE public.integration_contact_links FROM anon;
REVOKE ALL ON TABLE public.integration_contact_links FROM authenticated;

GRANT SELECT ON TABLE public.integration_contact_links TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.integration_contact_links FROM authenticated;

GRANT ALL ON TABLE public.integration_contact_links TO service_role;
