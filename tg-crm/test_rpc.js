import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkRpc() {
  const { data, error } = await supabase.rpc('run_sql', { sql: 'SELECT 1' });
  if (error) {
    console.log('RPC check failed:', error.message);
  } else {
    console.log('RPC check success:', data);
  }
}

checkRpc();
