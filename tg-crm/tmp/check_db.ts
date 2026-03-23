import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkTable() {
  const { data, error } = await supabase.from('pincode_routes').select('*').limit(1);
  if (error) {
    console.error("Error fetching pincode_routes:", error.message);
  } else {
    console.log("Success! Data:", data);
  }
}

checkTable();
