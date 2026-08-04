-- 025_digital_identity_cards.sql
-- Sprint 5.2 Phase 2 — Digital Identity persistence only.
--
-- Tables: digital_cards, digital_card_campaigns, digital_card_events
-- Advisor identity remains public.advisor_profiles (no second profile table).
-- Anonymous analytics live here — NOT public.activities.
-- No public SELECT. No SECURITY DEFINER public-read RPC in this migration.
-- No UI, routes, ingest, QR, vCard, tasks, or Cases.

-- =============================================================================
-- digital_cards
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.digital_cards (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  advisor_profile_id uuid NOT NULL REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  -- Opaque durable QR/NFC key. Immutable once issued (app-enforced); globally unique.
  public_key text NOT NULL,
  -- Human slug; mutable. Unique among non-deleted cards.
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  theme_key text NOT NULL DEFAULT 'default',
  -- Approved publish overrides (title, company, socials, visibility flags, etc.).
  -- Live identity fields still resolve from advisor_profiles at read time.
  publish_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT digital_cards_status_check
    CHECK (status IN ('draft', 'published', 'disabled')),
  CONSTRAINT digital_cards_public_key_format_check
    CHECK (public_key ~ '^[a-zA-Z0-9_-]{16,64}$'),
  CONSTRAINT digital_cards_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT digital_cards_slug_length_check
    CHECK (char_length(slug) BETWEEN 1 AND 64),
  CONSTRAINT digital_cards_theme_key_length_check
    CHECK (char_length(theme_key) BETWEEN 1 AND 64),
  CONSTRAINT digital_cards_public_key_unique UNIQUE (public_key)
);

COMMENT ON TABLE public.digital_cards IS
  'Digital Identity advisor cards (v1). Publish/addressing layer; advisor_profiles remains identity SoT.';
COMMENT ON COLUMN public.digital_cards.public_key IS
  'Durable opaque key for QR/NFC/print. Prefer /c/k/:public_key over mutable slug.';
COMMENT ON COLUMN public.digital_cards.slug IS
  'Human-readable URL slug. May change; does not invalidate printed public_key targets.';
COMMENT ON COLUMN public.digital_cards.publish_profile IS
  'Approved overrides only. Do not duplicate full advisor_profiles rows.';
COMMENT ON COLUMN public.digital_cards.cta_config IS
  'CTA configuration including primary Let''s Connect label metadata.';

-- One non-deleted card per advisor (v1).
CREATE UNIQUE INDEX IF NOT EXISTS digital_cards_one_active_per_advisor_uidx
  ON public.digital_cards (advisor_profile_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS digital_cards_slug_active_uidx
  ON public.digital_cards (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS digital_cards_published_idx
  ON public.digital_cards (status)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS digital_cards_advisor_profile_idx
  ON public.digital_cards (advisor_profile_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS digital_cards_set_updated_at ON public.digital_cards;
CREATE TRIGGER digital_cards_set_updated_at
  BEFORE UPDATE ON public.digital_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- digital_card_campaigns
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.digital_card_campaigns (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES public.digital_cards (id) ON DELETE CASCADE,
  campaign_code text NOT NULL,
  event_code text,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  default_utms jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_channel_default text NOT NULL DEFAULT 'link',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT digital_card_campaigns_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT digital_card_campaigns_source_channel_check
    CHECK (source_channel_default IN ('link', 'qr', 'nfc', 'share', 'unknown')),
  CONSTRAINT digital_card_campaigns_campaign_code_format_check
    CHECK (campaign_code ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'),
  CONSTRAINT digital_card_campaigns_event_code_format_check
    CHECK (
      event_code IS NULL
      OR event_code ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
    ),
  CONSTRAINT digital_card_campaigns_label_length_check
    CHECK (char_length(label) BETWEEN 1 AND 160)
);

COMMENT ON TABLE public.digital_card_campaigns IS
  'Campaign/event attribution codes for Digital Identity card links (QR/NFC/share).';

CREATE UNIQUE INDEX IF NOT EXISTS digital_card_campaigns_card_code_uidx
  ON public.digital_card_campaigns (digital_card_id, campaign_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS digital_card_campaigns_card_idx
  ON public.digital_card_campaigns (digital_card_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS digital_card_campaigns_set_updated_at ON public.digital_card_campaigns;
CREATE TRIGGER digital_card_campaigns_set_updated_at
  BEFORE UPDATE ON public.digital_card_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- digital_card_events (append-only anonymous analytics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.digital_card_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  digital_card_id uuid REFERENCES public.digital_cards (id) ON DELETE SET NULL,
  surface_public_key text NOT NULL,
  event_key text NOT NULL,
  anonymous_session_id text NOT NULL,
  campaign_code text,
  event_code text,
  source_channel text NOT NULL DEFAULT 'unknown',
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Allowlisted non-PII metadata only (enforced in application layer).
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Short-TTL operational abuse signal only. Prefer hash; never store contact PII.
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digital_card_events_event_key_check
    CHECK (
      event_key IN (
        'digital_identity.viewed',
        'digital_identity.contact_downloaded',
        'digital_identity.form_started',
        'digital_identity.form_submitted',
        'digital_identity.appointment_clicked',
        'digital_identity.diagnostic_clicked',
        'digital_identity.link_clicked',
        'digital_identity.share_clicked',
        'digital_identity.qr_scanned',
        'digital_identity.nfc_opened'
      )
    ),
  CONSTRAINT digital_card_events_source_channel_check
    CHECK (source_channel IN ('link', 'qr', 'nfc', 'share', 'unknown')),
  CONSTRAINT digital_card_events_session_format_check
    CHECK (anonymous_session_id ~ '^[a-zA-Z0-9_-]{8,128}$'),
  CONSTRAINT digital_card_events_public_key_format_check
    CHECK (surface_public_key ~ '^[a-zA-Z0-9_-]{16,64}$'),
  CONSTRAINT digital_card_events_ip_hash_length_check
    CHECK (ip_hash IS NULL OR char_length(ip_hash) BETWEEN 8 AND 128)
);

COMMENT ON TABLE public.digital_card_events IS
  'Anonymous Digital Identity analytics. Never household Activities. No contact PII columns.';
COMMENT ON COLUMN public.digital_card_events.ip_hash IS
  'Optional short-retention hash for abuse control. Do not store raw IP longer than operationally necessary.';

CREATE INDEX IF NOT EXISTS digital_card_events_card_occurred_idx
  ON public.digital_card_events (digital_card_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS digital_card_events_public_key_occurred_idx
  ON public.digital_card_events (surface_public_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS digital_card_events_event_key_occurred_idx
  ON public.digital_card_events (event_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS digital_card_events_occurred_idx
  ON public.digital_card_events (occurred_at DESC);

-- =============================================================================
-- RLS (no anon table SELECT; public reads via future API / SECURITY DEFINER RPC)
-- =============================================================================

ALTER TABLE public.digital_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_cards FORCE ROW LEVEL SECURITY;

ALTER TABLE public.digital_card_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_card_campaigns FORCE ROW LEVEL SECURITY;

ALTER TABLE public.digital_card_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_card_events FORCE ROW LEVEL SECURITY;

-- digital_cards ---------------------------------------------------------------

DROP POLICY IF EXISTS digital_cards_owner_select ON public.digital_cards;
CREATE POLICY digital_cards_owner_select ON public.digital_cards
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS digital_cards_owner_insert ON public.digital_cards;
CREATE POLICY digital_cards_owner_insert ON public.digital_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS digital_cards_owner_update ON public.digital_cards;
CREATE POLICY digital_cards_owner_update ON public.digital_cards
  FOR UPDATE TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS digital_cards_owner_delete ON public.digital_cards;
CREATE POLICY digital_cards_owner_delete ON public.digital_cards
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS digital_cards_advisor_select_own ON public.digital_cards;
CREATE POLICY digital_cards_advisor_select_own ON public.digital_cards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_is_advisor()
    AND advisor_profile_id = public.crm_advisor_id()
  );

DROP POLICY IF EXISTS digital_cards_advisor_insert_own ON public.digital_cards;
CREATE POLICY digital_cards_advisor_insert_own ON public.digital_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.crm_is_advisor()
    AND advisor_profile_id = public.crm_advisor_id()
  );

DROP POLICY IF EXISTS digital_cards_advisor_update_own ON public.digital_cards;
CREATE POLICY digital_cards_advisor_update_own ON public.digital_cards
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_is_advisor()
    AND advisor_profile_id = public.crm_advisor_id()
  )
  WITH CHECK (
    public.crm_is_advisor()
    AND advisor_profile_id = public.crm_advisor_id()
  );

-- digital_card_campaigns ------------------------------------------------------

DROP POLICY IF EXISTS digital_card_campaigns_owner_select ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_owner_select ON public.digital_card_campaigns
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS digital_card_campaigns_owner_insert ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_owner_insert ON public.digital_card_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS digital_card_campaigns_owner_update ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_owner_update ON public.digital_card_campaigns
  FOR UPDATE TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS digital_card_campaigns_owner_delete ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_owner_delete ON public.digital_card_campaigns
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS digital_card_campaigns_advisor_select_own ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_advisor_select_own ON public.digital_card_campaigns
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_is_advisor()
    AND EXISTS (
      SELECT 1
      FROM public.digital_cards c
      WHERE c.id = digital_card_id
        AND c.deleted_at IS NULL
        AND c.advisor_profile_id = public.crm_advisor_id()
    )
  );

DROP POLICY IF EXISTS digital_card_campaigns_advisor_insert_own ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_advisor_insert_own ON public.digital_card_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    public.crm_is_advisor()
    AND EXISTS (
      SELECT 1
      FROM public.digital_cards c
      WHERE c.id = digital_card_id
        AND c.deleted_at IS NULL
        AND c.advisor_profile_id = public.crm_advisor_id()
    )
  );

DROP POLICY IF EXISTS digital_card_campaigns_advisor_update_own ON public.digital_card_campaigns;
CREATE POLICY digital_card_campaigns_advisor_update_own ON public.digital_card_campaigns
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_is_advisor()
    AND EXISTS (
      SELECT 1
      FROM public.digital_cards c
      WHERE c.id = digital_card_id
        AND c.deleted_at IS NULL
        AND c.advisor_profile_id = public.crm_advisor_id()
    )
  )
  WITH CHECK (
    public.crm_is_advisor()
    AND EXISTS (
      SELECT 1
      FROM public.digital_cards c
      WHERE c.id = digital_card_id
        AND c.deleted_at IS NULL
        AND c.advisor_profile_id = public.crm_advisor_id()
    )
  );

-- digital_card_events (staff read only; writes via service_role / future RPC) -

DROP POLICY IF EXISTS digital_card_events_owner_select ON public.digital_card_events;
CREATE POLICY digital_card_events_owner_select ON public.digital_card_events
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS digital_card_events_advisor_select_own ON public.digital_card_events;
CREATE POLICY digital_card_events_advisor_select_own ON public.digital_card_events
  FOR SELECT TO authenticated
  USING (
    public.crm_is_advisor()
    AND digital_card_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.digital_cards c
      WHERE c.id = digital_card_id
        AND c.deleted_at IS NULL
        AND c.advisor_profile_id = public.crm_advisor_id()
    )
  );

-- =============================================================================
-- Grants (match platform conventions from 024)
-- anon: no CRM table grants
-- authenticated: privileges required for RLS policies to apply
-- service_role: operational DML (BYPASSRLS still applies)
-- =============================================================================

REVOKE ALL ON TABLE public.digital_cards FROM PUBLIC;
REVOKE ALL ON TABLE public.digital_cards FROM anon;
REVOKE ALL ON TABLE public.digital_cards FROM authenticated;
REVOKE ALL ON TABLE public.digital_card_campaigns FROM PUBLIC;
REVOKE ALL ON TABLE public.digital_card_campaigns FROM anon;
REVOKE ALL ON TABLE public.digital_card_campaigns FROM authenticated;
REVOKE ALL ON TABLE public.digital_card_events FROM PUBLIC;
REVOKE ALL ON TABLE public.digital_card_events FROM anon;
REVOKE ALL ON TABLE public.digital_card_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.digital_cards TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.digital_card_campaigns TO authenticated;

-- Events are append-only analytics; authenticated clients may read only.
-- Writes are reserved for service_role / future SECURITY DEFINER RPC.
GRANT SELECT ON TABLE public.digital_card_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.digital_cards,
  public.digital_card_campaigns,
  public.digital_card_events
TO service_role;
