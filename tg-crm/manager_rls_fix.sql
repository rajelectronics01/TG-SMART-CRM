-- 1. Drop the strict Admin-Only insert policy
DROP POLICY IF EXISTS "employees_insert" ON public.employees;

-- 2. Create a new Insert Policy that allows BOTH Admins AND Managers to create employees
CREATE POLICY "employees_insert" 
  ON public.employees FOR INSERT 
  WITH CHECK (
    -- If the executing user is an Admin, they can insert anyone
    public.get_employee_role(auth.uid()) = 'admin'
    OR 
    (
      -- If the executing user is a Manager...
      public.get_employee_role(auth.uid()) = 'manager' 
      AND 
      -- ...they can ONLY insert technicians (role = 'employee')
      role = 'employee' 
      AND 
      -- ...they MUST assign themselves as the parent_id
      parent_id = auth.uid()
    )
  );

-- 3. Also allow Managers to update their own Technicians (e.g., deactivate them)
DROP POLICY IF EXISTS "employees_update" ON public.employees;
CREATE POLICY "employees_update" 
  ON public.employees FOR UPDATE 
  USING (
    public.get_employee_role(auth.uid()) = 'admin' 
    OR id = auth.uid()
    OR (
        public.get_employee_role(auth.uid()) = 'manager' 
        AND parent_id = auth.uid()
    )
  );
