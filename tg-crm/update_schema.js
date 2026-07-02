import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyUpdates() {
  console.log('--- TG SMART Schema Update: Last Login Tracking ---');
  
  // Adding the last_login_at column to employees table
  const { error } = await supabase.rpc('run_sql', {
      sql_query: 'ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;'
  });

  if (error) {
    // If run_sql RPC is not enabled, we try a direct update if possible (unlikely via REST)
    // Most users won't have run_sql enabled. I'll just note it and tell the user to run it if it fails.
    console.error('Error adding column via RPC. Please ensure run_sql is enabled or run it in SQL Editor.');
    console.log('SQL: ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;');
  } else {
    console.log('✅ Column last_login_at added to employees table.');
  }
}

applyUpdates();
