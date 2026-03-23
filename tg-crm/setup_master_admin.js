import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqderwzwbbwizhgzelbm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZGVyd3p3YmJ3aXpoZ3plbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE2MjY0MSwiZXhwIjoyMDg5NzM4NjQxfQ.DLGClgLzWK-gqwrhmSN3Va_SE1oMt0shkT3Ex9_VFh4'.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setup() {
  console.log('--- TG SMART Supabase Setup Node Agent ---');
  
  const email = 'admin@tgsmart.in';
  const password = 'Parsh@tgsmart';

  // 1. Create the Auth User via Admin API (bypasses email confirmation requirements)
  console.log(`Creating Auth User: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { name: 'Master Admin' }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Proceeding to check employee record...');
    } else {
      console.error('Error creating auth user:', authError.message);
      return;
    }
  }

  const userId = authData?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id;
  
  if (!userId) {
    console.error('Could not determine User ID.');
    return;
  }

  console.log(`User ID identified: ${userId}`);

  // 2. Double check if employee record exists
  const { data: existingEmp } = await supabase.from('employees').select('id').eq('id', userId).single();

  if (existingEmp) {
    console.log('Employee record already exists. Upgrading to admin if necessary...');
    await supabase.from('employees').update({ role: 'admin', is_active: true }).eq('id', userId);
  } else {
    console.log('Creating Master Admin record in employees table...');
    const { error: dbError } = await supabase.from('employees').insert({
      id: userId,
      name: 'Master Admin',
      phone: '9999999999', // Placeholder
      email: email,
      role: 'admin',
      is_active: true
    });

    if (dbError) {
      console.error('Error creating employee record:', dbError.message);
      return;
    }
  }

  console.log('-------------------------------------------');
  console.log('SUCCESS: Master Admin is active.');
  console.log(`Login: ${email}`);
  console.log('You can now log into the TG SMART Portal.');
  console.log('-------------------------------------------');
}

setup();
