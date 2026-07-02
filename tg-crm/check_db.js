import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
  console.log('--- TG SMART Infrastructure Check ---');

  const tables = ['employees', 'customers', 'tickets', 'ticket_updates'];
  for (const table of tables) {
    const { data: cols, error: colError } = await supabase.from(table).select('*').limit(1);
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    
    if (error || colError) {
      console.error(`ERROR on table [${table}]: ${(error || colError).message}`);
    } else {
      console.log(`✅ Table [${table}]: Rows: ${count}, Columns: [${Object.keys(cols?.[0] || {}).join(', ')}]`);
    }
  }

  // Check Storage
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error(`ERROR listing buckets: ${bucketError.message}`);
  } else {
    const photoBucket = buckets.find(b => b.id === 'ticket-photos');
    if (photoBucket) console.log('✅ Bucket [ticket-photos] exists.');
    else console.error('❌ Bucket [ticket-photos] is MISSING.');
  }

  console.log('-------------------------------------------');
}

check();
