-- =============================================================================
-- TG SERVICE CRM — MIGRATION v4.0
-- Ensure complainant_type exists everywhere + add dealer_name support
-- =============================================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS complainant_type TEXT,
  ADD COLUMN IF NOT EXISTS dealer_name TEXT;

UPDATE public.tickets
SET complainant_type = NULL
WHERE complainant_type IS NOT NULL
  AND complainant_type NOT IN ('customer', 'dealer');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_complainant_type_check'
      AND conrelid = 'public.tickets'::regclass
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_complainant_type_check
      CHECK (complainant_type IN ('customer', 'dealer'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
