-- 001_extensions_and_enums.sql
-- Valtoris CRM: extensions, shared enums, and updated_at helper.
-- NOT EXECUTED YET. Placeholders only; no credentials.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- Prefer extensions.gen_random_uuid() in table defaults (search_path-safe).

-- ---------------------------------------------------------------------------
-- Enum helper: create type if missing (idempotent-safe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'owner',
    'advisor',
    'manager',
    'operations',
    'client'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.household_status AS ENUM (
    'lead',
    'prospect',
    'client',
    'inactive',
    'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new',
    'unassigned',
    'assigned',
    'converted',
    'closed_lost',
    'duplicate_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.assessment_type AS ENUM (
    'family',
    'business',
    'retirement',
    'protection'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.pipeline_type AS ENUM (
    'relationship',
    'service'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.opportunity_status AS ENUM (
    'open',
    'won',
    'lost',
    'on_hold'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'open',
    'in_progress',
    'done',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.note_visibility AS ENUM (
    'internal',
    'client_visible'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.document_visibility AS ENUM (
    'advisor_only',
    'client_visible',
    'owner_only'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.activity_type AS ENUM (
    'lead_created',
    'assessment_completed',
    'stage_changed',
    'assignment_changed',
    'note_added',
    'task_created',
    'task_completed',
    'call',
    'meeting',
    'document_uploaded',
    'policy_issued',
    'appointment_scheduled',
    'annual_review',
    'recommendation_created',
    'recommendation_reviewed',
    'recommendation_converted',
    'email_sent',
    'sms_sent',
    'policy_delivered',
    'referral_received',
    'referral_given',
    'annual_review_completed',
    'system',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'completed',
    'cancelled',
    'no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.duplicate_review_status AS ENUM (
    'none',
    'pending',
    'confirmed_unique',
    'merged',
    'dismissed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.assignment_reason AS ENUM (
    'advisor_link',
    'prospect_selected',
    'unassigned_pool',
    'manual',
    'round_robin',
    'state_based',
    'service_based',
    'referral_source',
    'language_based',
    'claim',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.member_relationship AS ENUM (
    'primary',
    'spouse',
    'partner',
    'child',
    'dependent',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.preferred_contact_method AS ENUM (
    'call',
    'text',
    'email',
    'any'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.attribution_method AS ENUM (
    'advisor_link',
    'prospect_selected',
    'unassigned_pool',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.recommendation_priority AS ENUM (
    'immediate',
    'high',
    'medium',
    'long_term'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.recommendation_status AS ENUM (
    'new',
    'under_review',
    'accepted',
    'deferred',
    'dismissed',
    'converted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Maintains updated_at on row UPDATE for CRM tables.';
