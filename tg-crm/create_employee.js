// Local-only stopgap for onboarding an employee/technician/manager account
// while the admin-user-actions Edge Function is not yet deployed.
// Run: node create_employee.js "Full Name" phone email password role [parent_id]
// role: employee | manager | admin
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const [name, phone, email, password, role = 'employee', parentId = null] = process.argv.slice(2);

if (!name || !phone || !email || !password) {
  console.log('Usage: node create_employee.js "Full Name" <phone> <email> <password> [role] [parent_id]');
  console.log('  role: employee | manager | admin (default: employee)');
  process.exit(1);
}

async function run() {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (authError) {
    console.error('Auth create failed:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  const { error: dbError } = await supabase.from('employees').insert({
    id: userId,
    name, phone, email, role,
    parent_id: role === 'employee' ? (parentId || null) : null,
    is_active: true
  });

  if (dbError) {
    console.error('Employee record failed, rolling back auth user:', dbError.message);
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log('Created:', { name, email, role, userId });
}

run();
