-- 005_fix_recursive_rls_regression.sql
-- =====================================================================
-- Fixes Postgres error 42P17 "infinite recursion detected in policy for
-- relation employees", which returned HTTP 500 on employees / tickets /
-- pincode_routes and blocked login + ticket creation on support.tgsmart.in.
--
-- Regression: after 001 + fix_rls_infinite_loop.sql (which introduced the
-- SECURITY DEFINER helpers), a recursive `employees_admin_write` ALL policy
-- and an inline employees sub-query in `tickets_hierarchy_access` (ending in
-- `OR true`) were re-added -- reintroducing the recursion and, via `OR true`,
-- giving every authenticated user full access to all tickets.
--
-- This migration restores the SECURITY DEFINER approach for every affected
-- table and enforces the ticket hierarchy (admin / assignee / manager).
-- Transactional (all-or-nothing) and idempotent (safe to re-run).
--
-- RUN THIS IN THE SQL EDITOR OF THE *PRODUCTION* PROJECT: ygvvlbbwmckuwvayyynb
-- (NOT the stale project referenced by .env.local).
-- =====================================================================

begin;

-- Ensure the SECURITY DEFINER helpers exist and are hardened. No-op if present.
create or replace function public.get_employee_role(user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare app_role text;
begin
  select role into app_role from public.employees where id = user_id;
  return app_role;
end;
$$;

create or replace function public.get_employee_parent(emp_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare mgr_id uuid;
begin
  select parent_id into mgr_id from public.employees where id = emp_id;
  return mgr_id;
end;
$$;

-- 1) ROOT CAUSE: drop the recursive ALL policy on employees.
--    Admin write capability stays intact via employees_insert/update/delete.
drop policy if exists employees_admin_write on public.employees;

-- 2) TICKETS: reuse the helpers and remove the `OR true` open-access hole,
--    enforcing admin / assignee / manager(direct + parent) access.
drop policy if exists tickets_hierarchy_access on public.tickets;
create policy tickets_hierarchy_access on public.tickets
  for all
  using (
        public.get_employee_role(auth.uid()) = 'admin'
     or assigned_to = auth.uid()
     or manager_id  = auth.uid()
     or public.get_employee_parent(assigned_to) = auth.uid()
  );
-- (Anonymous complaint submission keeps working via tickets_insert_anon.)

-- 3) CUSTOMERS: admin update no longer sub-queries employees inline.
drop policy if exists customers_admin_update on public.customers;
create policy customers_admin_update on public.customers
  for update
  using (public.get_employee_role(auth.uid()) = 'admin');

-- 4) PINCODE_ROUTES: admin management.
drop policy if exists pincode_routes_admin on public.pincode_routes;
create policy pincode_routes_admin on public.pincode_routes
  for all
  using (public.get_employee_role(auth.uid()) = 'admin');

-- 5) SPARES: owner or admin may update.
drop policy if exists spares_update on public.spares;
create policy spares_update on public.spares
  for update
  using (added_by = auth.uid() or public.get_employee_role(auth.uid()) = 'admin');

commit;

-- =====================================================================
-- Verify (should show NO policy whose qual/with_check contains
-- "FROM employees" inline -- only get_employee_role/get_employee_parent):
-- select tablename, policyname, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
-- =====================================================================
