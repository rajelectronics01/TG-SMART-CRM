import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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
