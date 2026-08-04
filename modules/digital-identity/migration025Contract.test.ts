import { describe, expect, it } from 'vitest'
import { DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS } from './constants'
import {
  MIGRATION_025_CONTRACT_MARKERS,
  MIGRATION_025_FILENAME,
  MIGRATION_025_FORBIDDEN_MARKERS,
} from './migration025Contract'

describe('migration 025 digital identity persistence contract', () => {
  it('records the approved migration filename', () => {
    expect(MIGRATION_025_FILENAME).toBe('025_digital_identity_cards.sql')
  })

  it('requires digital_cards schema, uniqueness, RLS, and grant markers', () => {
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'CREATE TABLE IF NOT EXISTS public.digital_cards',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'CREATE TABLE IF NOT EXISTS public.digital_card_campaigns',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'CREATE TABLE IF NOT EXISTS public.digital_card_events',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'advisor_profile_id uuid NOT NULL REFERENCES public.advisor_profiles',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain('digital_cards_one_active_per_advisor_uidx')
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain('digital_cards_slug_active_uidx')
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'CONSTRAINT digital_cards_public_key_unique UNIQUE (public_key)',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'ALTER TABLE public.digital_cards FORCE ROW LEVEL SECURITY',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'REVOKE ALL ON TABLE public.digital_cards FROM anon',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain(
      'GRANT SELECT ON TABLE public.digital_card_events TO authenticated',
    )
    expect(MIGRATION_025_CONTRACT_MARKERS).toContain('NOT public.activities')
  })

  it('allowlists every anonymous analytics event key from the TypeScript contract', () => {
    for (const eventKey of DIGITAL_IDENTITY_ANONYMOUS_EVENT_KEYS) {
      expect(MIGRATION_025_CONTRACT_MARKERS).toContain(`'${eventKey}'`)
    }
  })

  it('forbids identity_surfaces, public-read RPCs, ingest RPCs, and anon grants', () => {
    expect(MIGRATION_025_FORBIDDEN_MARKERS).toContain(
      'CREATE TABLE IF NOT EXISTS public.identity_surfaces',
    )
    expect(MIGRATION_025_FORBIDDEN_MARKERS).toContain(
      'CREATE OR REPLACE FUNCTION public.get_published_digital_card',
    )
    expect(MIGRATION_025_FORBIDDEN_MARKERS).toContain('ingest_digital_identity')
    expect(MIGRATION_025_FORBIDDEN_MARKERS).toContain('TO anon')
  })
})
