/**
 * Migration 025 contract markers — Digital Identity persistence layer.
 * Avoids node:fs imports under the browser tsconfig (same pattern as migration 022).
 */

export const MIGRATION_025_FILENAME = '025_digital_identity_cards.sql' as const

/** Required schema / security markers for Sprint 5.2 Phase 2. */
export const MIGRATION_025_CONTRACT_MARKERS = [
  'CREATE TABLE IF NOT EXISTS public.digital_cards',
  'CREATE TABLE IF NOT EXISTS public.digital_card_campaigns',
  'CREATE TABLE IF NOT EXISTS public.digital_card_events',
  'advisor_profile_id uuid NOT NULL REFERENCES public.advisor_profiles',
  'CONSTRAINT digital_cards_status_check',
  "CHECK (status IN ('draft', 'published', 'disabled'))",
  'CONSTRAINT digital_cards_public_key_format_check',
  "CHECK (public_key ~ '^[a-zA-Z0-9_-]{16,64}$')",
  'CONSTRAINT digital_cards_slug_format_check',
  'CONSTRAINT digital_cards_public_key_unique UNIQUE (public_key)',
  'digital_cards_one_active_per_advisor_uidx',
  'digital_cards_slug_active_uidx',
  'digital_cards_published_idx',
  'digital_card_campaigns_card_code_uidx',
  'digital_card_events_card_occurred_idx',
  'digital_card_events_public_key_occurred_idx',
  'digital_card_events_event_key_occurred_idx',
  "'digital_identity.viewed'",
  "'digital_identity.contact_downloaded'",
  "'digital_identity.form_started'",
  "'digital_identity.form_submitted'",
  "'digital_identity.appointment_clicked'",
  "'digital_identity.diagnostic_clicked'",
  "'digital_identity.link_clicked'",
  "'digital_identity.share_clicked'",
  "'digital_identity.qr_scanned'",
  "'digital_identity.nfc_opened'",
  'ALTER TABLE public.digital_cards FORCE ROW LEVEL SECURITY',
  'ALTER TABLE public.digital_card_campaigns FORCE ROW LEVEL SECURITY',
  'ALTER TABLE public.digital_card_events FORCE ROW LEVEL SECURITY',
  'CREATE POLICY digital_cards_owner_select',
  'CREATE POLICY digital_cards_advisor_select_own',
  'CREATE POLICY digital_card_campaigns_advisor_select_own',
  'CREATE POLICY digital_card_events_owner_select',
  'CREATE POLICY digital_card_events_advisor_select_own',
  'REVOKE ALL ON TABLE public.digital_cards FROM anon',
  'REVOKE ALL ON TABLE public.digital_cards FROM authenticated',
  'REVOKE ALL ON TABLE public.digital_card_campaigns FROM anon',
  'REVOKE ALL ON TABLE public.digital_card_events FROM anon',
  'REVOKE ALL ON TABLE public.digital_card_events FROM authenticated',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.digital_cards TO authenticated',
  'GRANT SELECT ON TABLE public.digital_card_events TO authenticated',
  'TO service_role',
  'NOT public.activities',
] as const

export const MIGRATION_025_FORBIDDEN_MARKERS = [
  'CREATE TABLE IF NOT EXISTS public.identity_surfaces',
  'CREATE OR REPLACE FUNCTION public.get_published_digital_card',
  'CREATE OR REPLACE FUNCTION public.record_digital_card_event',
  'ingest_digital_identity',
  'TO anon',
] as const
