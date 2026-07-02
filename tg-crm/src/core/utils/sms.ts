import { supabase } from '../supabase/client';

/**
 * Sends an SMS using the Supabase Database function 'send_sms_fast2sms'.
 * This bypasses browser blocks (CORS) and keeps the API Key secure on the server.
 */
export async function sendSMS(phone: string, message: string) {
  try {
    // 1. Basic phone cleaning (get last 10 digits)
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      console.warn('Invalid phone number for SMS:', phone);
      return { return: false, message: "Invalid Phone Number" };
    }

    // 2. Call the Database RPC function we just created in SQL
    const { data, error } = await (supabase as any).rpc('send_sms_fast2sms', { 
      phone: cleanPhone, 
      msg: message 
    });

    if (error) {
      console.error('Supabase SMS RPC Error:', error);
      return { return: false, message: error.message };
    }

    // 3. Log results for debugging
    console.log('Database SMS Sent. Result:', data);
    return data; // This will return the Fast2SMS response object

  } catch (err) {
    console.error('SMS Gateway Logic Error:', err);
    return { return: false, message: "Server Communication Error" };
  }
}
