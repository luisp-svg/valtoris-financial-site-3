-- Approved Phase 4 safeguards. Preserve all existing card keys and URLs.
BEGIN;
LOCK TABLE public.digital_cards IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM public.digital_cards WHERE deleted_at IS NULL
  GROUP BY advisor_profile_id HAVING count(*) > 1
 ) THEN
  RAISE EXCEPTION 'CRM_DI:duplicate_active_cards_require_review';
 END IF;
END $$;
-- Reuse digital_cards_one_active_per_advisor_uidx from migration 025.
-- No duplicate index and no new table or column is necessary.

CREATE FUNCTION public.protect_digital_card_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'CRM_DI:retire_card_instead_of_delete';
 END IF;
 IF NEW.public_key IS DISTINCT FROM OLD.public_key
    OR NEW.advisor_profile_id IS DISTINCT FROM OLD.advisor_profile_id THEN
  RAISE EXCEPTION 'CRM_DI:permanent_identity_is_immutable';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_digital_card_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER digital_cards_protect_identity
 BEFORE UPDATE OR DELETE ON public.digital_cards
 FOR EACH ROW EXECUTE FUNCTION public.protect_digital_card_identity();
COMMENT ON COLUMN public.digital_cards.public_key IS
 'Permanent QR/NFC key. Database-enforced immutable; retained on retired cards and never reused. Prefer /c/k/:public_key over mutable slug.';
COMMIT;
