import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqderwzwbbwizhgzelbm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZGVyd3p3YmJ3aXpoZ3plbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE2MjY0MSwiZXhwIjoyMDg5NzM4NjQxfQ.DLGClgLzWK-gqwrhmSN3Va_SE1oMt0shkT3Ex9_VFh4';

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
