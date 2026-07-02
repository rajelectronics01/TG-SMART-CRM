-- =============================================================================
-- TG SERVICE CRM — MIGRATION v3.0
-- Add complainant type (customer/dealer) to tickets
-- =============================================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS complainant_type TEXT
  CHECK (complainant_type IN ('customer', 'dealer'));
