import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wqderwzwbbwizhgzelbm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZGVyd3p3YmJ3aXpoZ3plbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE2MjY0MSwiZXhwIjoyMDg5NzM4NjQxfQ.DLGClgLzWK-gqwrhmSN3Va_SE1oMt0shkT3Ex9_VFh4'.trim();

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
