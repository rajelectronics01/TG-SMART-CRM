import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqderwzwbbwizhgzelbm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZGVyd3p3YmJ3aXpoZ3plbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE2MjY0MSwiZXhwIjoyMDg5NzM4NjQxfQ.DLGClgLzWK-gqwrhmSN3Va_SE1oMt0shkT3Ex9_VFh4'.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('employees').select('id, email, name, role');
  if (error) {
    console.error(error);
  } else {
    console.log('Employees:', data.length);
    console.log(data);
  }
}

run();
