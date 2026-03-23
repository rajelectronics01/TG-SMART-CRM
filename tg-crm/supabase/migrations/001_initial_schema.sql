-- =============================================================================
-- TG SERVICE CRM — SUPABASE MIGRATION v1.0
-- Run this in your Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. EMPLOYEES ────────────────────────────────────────────────────────────
-- NOTE: Employees use Supabase Auth. Their auth.users UUID is their employee id.
CREATE TABLE IF NOT EXISTS public.employees (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(15) UNIQUE NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. CUSTOMERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(15) UNIQUE NOT NULL,
  email       VARCHAR(100),
  address     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. TICKETS ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM (
    'new','assigned','in_progress','parts_needed','parts_ordered','resolved','cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number       VARCHAR(30) UNIQUE NOT NULL,
  customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  assigned_to         UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  product_type        VARCHAR(60) NOT NULL,
  product_brand       VARCHAR(60) NOT NULL,
  product_model       VARCHAR(60) DEFAULT '',
  purchase_date       DATE,
  issue_description   TEXT NOT NULL,
  status              ticket_status NOT NULL DEFAULT 'new',
  visit_date          TIMESTAMPTZ,
  photos              TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ
);

-- Auto-generate ticket_number on insert
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  seq INT;
  datestamp TEXT := to_char(now(), 'YYYYMMDD');
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM public.tickets
  WHERE ticket_number LIKE 'TKT-' || datestamp || '-%';
  NEW.ticket_number := 'TKT-' || datestamp || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
EXECUTE FUNCTION generate_ticket_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. TICKET UPDATES (Audit Trail) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_updates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  updated_by  UUID NOT NULL REFERENCES public.employees(id),
  old_status  ticket_status NOT NULL,
  new_status  ticket_status NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. SPARES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spares (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  part_name   VARCHAR(100) NOT NULL,
  part_number VARCHAR(60),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status      TEXT NOT NULL DEFAULT 'needed' CHECK (status IN ('needed','ordered','delivered')),
  notes       TEXT,
  added_by    UUID NOT NULL REFERENCES public.employees(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) — CRITICAL FOR SECURITY
-- =============================================================================

ALTER TABLE public.employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spares       ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.employees WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Employees Table RLS ──────────────────────────────────────────────────────
-- Read: anyone authenticated can read basic employee info
CREATE POLICY "employees_read" ON public.employees FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: only admins
CREATE POLICY "employees_admin_write" ON public.employees FOR ALL
  USING (get_my_role() = 'admin');

-- ── Customers Table RLS ──────────────────────────────────────────────────────
-- Anon can INSERT (to submit complaints)
CREATE POLICY "customers_insert_anon" ON public.customers FOR INSERT
  WITH CHECK (true);

-- Authenticated employees/admins can read
CREATE POLICY "customers_authenticated_read" ON public.customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can update
CREATE POLICY "customers_admin_update" ON public.customers FOR UPDATE
  USING (get_my_role() = 'admin');

-- ── Tickets Table RLS ────────────────────────────────────────────────────────
-- Anon can INSERT (submit complaint form)
CREATE POLICY "tickets_insert_anon" ON public.tickets FOR INSERT
  WITH CHECK (true);

-- Anon SELECT for tracking only (limited via application-level masking)
CREATE POLICY "tickets_select_public" ON public.tickets FOR SELECT
  USING (true);

-- Employees see only their assigned tickets
CREATE POLICY "tickets_employee_update" ON public.tickets FOR UPDATE
  USING (
    assigned_to = auth.uid() OR get_my_role() = 'admin'
  );

-- ── Ticket Updates RLS ──────────────────────────────────────────────────────
CREATE POLICY "ticket_updates_select" ON public.ticket_updates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ticket_updates_insert" ON public.ticket_updates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND updated_by = auth.uid());

-- ── Spares RLS ───────────────────────────────────────────────────────────────
CREATE POLICY "spares_select" ON public.spares FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "spares_insert" ON public.spares FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND added_by = auth.uid());

CREATE POLICY "spares_update" ON public.spares FOR UPDATE
  USING (
    added_by = auth.uid() OR get_my_role() = 'admin'
  );

-- =============================================================================
-- STORAGE BUCKET for Ticket Photos
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ticket_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-photos');

CREATE POLICY "ticket_photos_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ticket-photos');

-- =============================================================================
-- Done! Your TG Service CRM database is ready.
-- Next: Create your first admin user via Supabase Auth Dashboard,
--       then insert their record into the employees table with role='admin'.
-- =============================================================================
