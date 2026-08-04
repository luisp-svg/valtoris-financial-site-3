/**
 * Migration 028 contract markers — campaign attribution schema.
 */

export const MIGRATION_028_FILENAME =
  '028_digital_identity_campaign_attribution.sql' as const

export const MIGRATION_028_CONTRACT_MARKERS = [
  'ALTER TABLE public.digital_card_campaigns',
  'ADD COLUMN IF NOT EXISTS description text',
  'ADD COLUMN IF NOT EXISTS starts_at timestamptz',
  'ADD COLUMN IF NOT EXISTS ends_at timestamptz',
  'ADD COLUMN IF NOT EXISTS location_label text',
  'ADD COLUMN IF NOT EXISTS organizer text',
  'ADD COLUMN IF NOT EXISTS advisor_notes text',
  'ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.profiles (id)',
  'digital_card_campaigns_description_len_check',
  'char_length(description) <= 1000',
  'digital_card_campaigns_location_label_len_check',
  'char_length(location_label) <= 200',
  'digital_card_campaigns_organizer_len_check',
  'char_length(organizer) <= 200',
  'digital_card_campaigns_advisor_notes_len_check',
  'char_length(advisor_notes) <= 2000',
  'digital_card_campaigns_lifecycle_ends_after_starts_check',
  'ends_at IS NULL',
  'OR starts_at IS NULL',
  'OR ends_at >= starts_at',
  'digital_card_campaigns_created_by_idx',
  'ALTER TABLE public.leads',
  'last_touch_source_metadata jsonb NOT NULL DEFAULT',
  'leads_last_touch_source_metadata_object_check',
  "jsonb_typeof(last_touch_source_metadata) = 'object'",
  'CREATE OR REPLACE FUNCTION public.enforce_immutable_digital_card_campaign_identifiers()',
  'SET search_path = pg_catalog, public, extensions',
  'NEW.digital_card_id IS DISTINCT FROM OLD.digital_card_id',
  'NEW.campaign_code IS DISTINCT FROM OLD.campaign_code',
  'NEW.event_code IS DISTINCT FROM OLD.event_code',
  'DI_CAMPAIGN:immutable_digital_card_id',
  'DI_CAMPAIGN:immutable_campaign_code',
  'DI_CAMPAIGN:immutable_event_code',
  "ERRCODE = '22023'",
  'DROP TRIGGER IF EXISTS digital_card_campaigns_immutable_identifiers',
  'CREATE TRIGGER digital_card_campaigns_immutable_identifiers',
  'BEFORE UPDATE ON public.digital_card_campaigns',
  'EXECUTE FUNCTION public.enforce_immutable_digital_card_campaign_identifiers()',
  'REVOKE ALL ON FUNCTION public.enforce_immutable_digital_card_campaign_identifiers()',
] as const

export const MIGRATION_028_FORBIDDEN_MARKERS = [
  'CREATE TABLE IF NOT EXISTS public.digital_card_campaign_events',
  'CREATE TABLE IF NOT EXISTS public.events',
  'ALTER TABLE public.households',
  'GRANT SELECT ON TABLE public.digital_card_campaigns TO anon',
  'CREATE OR REPLACE FUNCTION public.get_published_campaign',
  '029_',
] as const

/** Stable error-message contract for PostgREST / clients. */
export const MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS = [
  'DI_CAMPAIGN:immutable_digital_card_id',
  'DI_CAMPAIGN:immutable_campaign_code',
  'DI_CAMPAIGN:immutable_event_code',
] as const

/** SQLSTATE used by the immutability trigger (invalid_parameter_value). */
export const MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE = '22023' as const
