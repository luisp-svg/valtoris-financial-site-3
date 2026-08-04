-- =============================================================================
-- 028_digital_identity_campaign_attribution.sql
-- Sprint 5.9 — Campaign/event fields + lead last-touch metadata
-- =============================================================================
-- Extends digital_card_campaigns (no separate events table).
-- Adds leads.last_touch_source_metadata only (not households).
-- First-touch original_campaign / original_source_metadata remain immutable.
-- Trusted campaign resolution + attribution activities are applied server-side
-- in the Digital Identity ingest TypeScript path (service_role).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) digital_card_campaigns expansion
-- ---------------------------------------------------------------------------

ALTER TABLE public.digital_card_campaigns
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS organizer text,
  ADD COLUMN IF NOT EXISTS advisor_notes text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.digital_card_campaigns
  DROP CONSTRAINT IF EXISTS digital_card_campaigns_description_len_check;
ALTER TABLE public.digital_card_campaigns
  ADD CONSTRAINT digital_card_campaigns_description_len_check
  CHECK (description IS NULL OR char_length(description) <= 1000);

ALTER TABLE public.digital_card_campaigns
  DROP CONSTRAINT IF EXISTS digital_card_campaigns_location_label_len_check;
ALTER TABLE public.digital_card_campaigns
  ADD CONSTRAINT digital_card_campaigns_location_label_len_check
  CHECK (location_label IS NULL OR char_length(location_label) <= 200);

ALTER TABLE public.digital_card_campaigns
  DROP CONSTRAINT IF EXISTS digital_card_campaigns_organizer_len_check;
ALTER TABLE public.digital_card_campaigns
  ADD CONSTRAINT digital_card_campaigns_organizer_len_check
  CHECK (organizer IS NULL OR char_length(organizer) <= 200);

ALTER TABLE public.digital_card_campaigns
  DROP CONSTRAINT IF EXISTS digital_card_campaigns_advisor_notes_len_check;
ALTER TABLE public.digital_card_campaigns
  ADD CONSTRAINT digital_card_campaigns_advisor_notes_len_check
  CHECK (advisor_notes IS NULL OR char_length(advisor_notes) <= 2000);

ALTER TABLE public.digital_card_campaigns
  DROP CONSTRAINT IF EXISTS digital_card_campaigns_lifecycle_ends_after_starts_check;
ALTER TABLE public.digital_card_campaigns
  ADD CONSTRAINT digital_card_campaigns_lifecycle_ends_after_starts_check
  CHECK (
    ends_at IS NULL
    OR starts_at IS NULL
    OR ends_at >= starts_at
  );

COMMENT ON COLUMN public.digital_card_campaigns.description IS
  'Optional public-safe campaign description (never exposes advisor_notes).';
COMMENT ON COLUMN public.digital_card_campaigns.advisor_notes IS
  'Private CRM notes. Never returned on public card or anonymous surfaces.';
COMMENT ON COLUMN public.digital_card_campaigns.created_by_user_id IS
  'CRM auth user (profiles.id / auth.users.id) who created the campaign row.';

CREATE INDEX IF NOT EXISTS digital_card_campaigns_created_by_idx
  ON public.digital_card_campaigns (created_by_user_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- B) leads.last_touch_source_metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_touch_source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_last_touch_source_metadata_object_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_last_touch_source_metadata_object_check
  CHECK (jsonb_typeof(last_touch_source_metadata) = 'object');

COMMENT ON COLUMN public.leads.last_touch_source_metadata IS
  'Allowlisted last-touch Digital Identity attribution. Mutable. Never overwrites original_* first-touch fields.';

-- ---------------------------------------------------------------------------
-- C) Immutable campaign identifiers after insert (defense in depth)
-- ---------------------------------------------------------------------------
-- digital_card_id, campaign_code, and event_code are stable public attribution
-- identifiers. CRM UI/API already strip these from updates; this trigger blocks
-- direct authenticated PostgREST rewrites for owner and advisor (and any other
-- role). Same-value updates are allowed (IS DISTINCT FROM). Mutable descriptive
-- and lifecycle fields remain writable under existing RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_immutable_digital_card_campaign_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.digital_card_id IS DISTINCT FROM OLD.digital_card_id THEN
    RAISE EXCEPTION 'DI_CAMPAIGN:immutable_digital_card_id'
      USING ERRCODE = '22023',
            HINT = 'digital_card_campaigns.digital_card_id cannot change after insert';
  END IF;

  IF NEW.campaign_code IS DISTINCT FROM OLD.campaign_code THEN
    RAISE EXCEPTION 'DI_CAMPAIGN:immutable_campaign_code'
      USING ERRCODE = '22023',
            HINT = 'digital_card_campaigns.campaign_code cannot change after insert';
  END IF;

  IF NEW.event_code IS DISTINCT FROM OLD.event_code THEN
    RAISE EXCEPTION 'DI_CAMPAIGN:immutable_event_code'
      USING ERRCODE = '22023',
            HINT = 'digital_card_campaigns.event_code cannot change after insert (including NULL↔value)';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_immutable_digital_card_campaign_identifiers() IS
  'BEFORE UPDATE: reject changes to digital_card_id, campaign_code, or event_code. Same-value updates allowed. Descriptive/lifecycle fields unaffected.';

DROP TRIGGER IF EXISTS digital_card_campaigns_immutable_identifiers
  ON public.digital_card_campaigns;
CREATE TRIGGER digital_card_campaigns_immutable_identifiers
  BEFORE UPDATE ON public.digital_card_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutable_digital_card_campaign_identifiers();

REVOKE ALL ON FUNCTION public.enforce_immutable_digital_card_campaign_identifiers()
  FROM PUBLIC, anon, authenticated;
