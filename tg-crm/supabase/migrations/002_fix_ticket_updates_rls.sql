-- Re-enable RLS on ticket_updates (was flagged as disabled by Supabase's security linter)
-- and restore the original policies from 001_initial_schema.sql.
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_updates_select" ON public.ticket_updates;
CREATE POLICY "ticket_updates_select" ON public.ticket_updates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_updates_insert" ON public.ticket_updates;
CREATE POLICY "ticket_updates_insert" ON public.ticket_updates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND updated_by = auth.uid());

-- No UPDATE/DELETE policy: this table is an audit trail of status changes.
-- Deliberately immutable once written -- technicians/admins should not be able
-- to edit or erase history, only append to it.
