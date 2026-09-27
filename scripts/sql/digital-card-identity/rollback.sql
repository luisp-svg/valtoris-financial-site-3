-- Emergency rollback: weakens the permanent-identity guarantee, but preserves every card.
-- Coordinate application rollout and migration bookkeeping separately. Prefer forward repair.
BEGIN;
DROP TRIGGER digital_cards_protect_identity ON public.digital_cards;
DROP FUNCTION public.protect_digital_card_identity();
COMMENT ON COLUMN public.digital_cards.public_key IS
 'Durable opaque key for QR/NFC/print. Prefer /c/k/:public_key over mutable slug.';
-- Keep the existing migration-025 unique indexes, keys, and all card rows.
COMMIT;
