-- =============================================================================
-- TG SERVICE CRM — MIGRATION v2.0
-- Simplify ticket status flow + technician-wise spare part tracking
-- =============================================================================

-- 1) Normalize old ticket statuses to the new compact workflow
UPDATE public.tickets
SET status = CASE
  WHEN status = 'in_progress' THEN 'assigned'::ticket_status
  WHEN status = 'parts_ordered' THEN 'parts_needed'::ticket_status
  WHEN status = 'cancelled' THEN 'resolved'::ticket_status
  ELSE status
END
WHERE status IN ('in_progress', 'parts_ordered', 'cancelled');

UPDATE public.ticket_updates
SET old_status = CASE
  WHEN old_status = 'in_progress' THEN 'assigned'::ticket_status
  WHEN old_status = 'parts_ordered' THEN 'parts_needed'::ticket_status
  WHEN old_status = 'cancelled' THEN 'resolved'::ticket_status
  ELSE old_status
END,
new_status = CASE
  WHEN new_status = 'in_progress' THEN 'assigned'::ticket_status
  WHEN new_status = 'parts_ordered' THEN 'parts_needed'::ticket_status
  WHEN new_status = 'cancelled' THEN 'resolved'::ticket_status
  ELSE new_status
END
WHERE old_status IN ('in_progress', 'parts_ordered', 'cancelled')
   OR new_status IN ('in_progress', 'parts_ordered', 'cancelled');

-- 2) Rebuild enum without deprecated values
ALTER TYPE ticket_status RENAME TO ticket_status_old;

CREATE TYPE ticket_status AS ENUM (
  'new',
  'assigned',
  'parts_needed',
  'resolved'
);

ALTER TABLE public.tickets
  ALTER COLUMN status TYPE ticket_status
  USING status::text::ticket_status;

ALTER TABLE public.ticket_updates
  ALTER COLUMN old_status TYPE ticket_status
  USING old_status::text::ticket_status,
  ALTER COLUMN new_status TYPE ticket_status
  USING new_status::text::ticket_status;

DROP TYPE ticket_status_old;

-- 3) Technician-wise traceability fields on spares
ALTER TABLE public.spares
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_status TEXT NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending','installed','returned','unused')),
  ADD COLUMN IF NOT EXISTS action_note TEXT,
  ADD COLUMN IF NOT EXISTS action_updated_at TIMESTAMPTZ;

UPDATE public.spares
SET action_updated_at = COALESCE(action_updated_at, created_at)
WHERE action_updated_at IS NULL;
