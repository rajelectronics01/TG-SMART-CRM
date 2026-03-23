-- 1. FIX EMPLOYEE ROLES
ALTER TABLE IF EXISTS public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check CHECK (role IN ('employee', 'admin', 'manager'));
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS service_notes TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS service_photos TEXT[] DEFAULT '{}';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS public.pincode_routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pincode     VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pincode, employee_id)
);
ALTER TABLE public.pincode_routes ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.auto_assign_manager_by_pincode()
RETURNS TRIGGER AS $$
DECLARE
  target_manager_id UUID;
  customer_pincode TEXT;
BEGIN
  SELECT pincode INTO customer_pincode FROM public.customers WHERE id = NEW.customer_id;
  SELECT employee_id INTO target_manager_id
  FROM public.pincode_routes
  WHERE pincode = customer_pincode
  LIMIT 1;
  IF target_manager_id IS NOT NULL THEN
    NEW.manager_id := target_manager_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_ticket_create_assign_manager ON public.tickets;
CREATE TRIGGER on_ticket_create_assign_manager
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_manager_by_pincode();
DROP POLICY IF EXISTS "employees_read" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_write" ON public.employees;
DROP POLICY IF EXISTS "pincode_routes_read" ON public.pincode_routes;
DROP POLICY IF EXISTS "pincode_routes_admin" ON public.pincode_routes;
DROP POLICY IF EXISTS "tickets_employee_update" ON public.tickets;
DROP POLICY IF EXISTS "tickets_hierarchy_access" ON public.tickets;
CREATE POLICY "employees_read" ON public.employees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "employees_admin_write" ON public.employees FOR ALL USING (EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pincode_routes_read" ON public.pincode_routes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pincode_routes_admin" ON public.pincode_routes FOR ALL USING (EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "tickets_hierarchy_access" ON public.tickets FOR ALL USING ((SELECT role FROM public.employees WHERE id = auth.uid()) = 'admin' OR assigned_to = auth.uid() OR manager_id = auth.uid() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = public.tickets.assigned_to AND e.parent_id = auth.uid()));
