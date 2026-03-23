-- 1. Create a secure function to bypass RLS when checking an employee's role
CREATE OR REPLACE FUNCTION public.get_employee_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  app_role TEXT;
BEGIN
  SELECT role INTO app_role FROM public.employees WHERE id = user_id;
  RETURN app_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a secure function to bypass RLS when checking an employee's parent_id (manager)
CREATE OR REPLACE FUNCTION public.get_employee_parent(emp_id UUID)
RETURNS UUID AS $$
DECLARE
  mgr_id UUID;
BEGIN
  SELECT parent_id INTO mgr_id FROM public.employees WHERE id = emp_id;
  RETURN mgr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop all the recursive/broken policies
DROP POLICY IF EXISTS "employees_read" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_write" ON public.employees;
DROP POLICY IF EXISTS "employees_write" ON public.employees;
DROP POLICY IF EXISTS "pincode_routes_read" ON public.pincode_routes;
DROP POLICY IF EXISTS "pincode_routes_admin" ON public.pincode_routes;
DROP POLICY IF EXISTS "pincode_routes_all" ON public.pincode_routes;
DROP POLICY IF EXISTS "tickets_hierarchy_access" ON public.tickets;
DROP POLICY IF EXISTS "tickets_all" ON public.tickets;

-- 4. Re-create employees policies using the secure function (avoids infinite loop)
CREATE POLICY "employees_read" 
  ON public.employees FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "employees_insert" 
  ON public.employees FOR INSERT 
  WITH CHECK (public.get_employee_role(auth.uid()) = 'admin');

CREATE POLICY "employees_update" 
  ON public.employees FOR UPDATE 
  USING (public.get_employee_role(auth.uid()) = 'admin' OR id = auth.uid());

CREATE POLICY "employees_delete" 
  ON public.employees FOR DELETE 
  USING (public.get_employee_role(auth.uid()) = 'admin');

-- 5. Re-create pincode_routes policies
CREATE POLICY "pincode_routes_read" 
  ON public.pincode_routes FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "pincode_routes_write" 
  ON public.pincode_routes FOR ALL 
  USING (public.get_employee_role(auth.uid()) = 'admin');

-- 6. Re-create tickets policies
CREATE POLICY "tickets_hierarchy_access" 
  ON public.tickets FOR ALL 
  USING (
    public.get_employee_role(auth.uid()) = 'admin'
    OR assigned_to = auth.uid()
    OR manager_id = auth.uid()
    OR public.get_employee_parent(assigned_to) = auth.uid()
  );
